from django.db import models, transaction
from django.contrib.auth.models import User
from django.core.exceptions import ValidationError

class Category(models.Model):
    name = models.CharField(max_length=100, unique=True)
    description = models.TextField(blank=True, null=True)

    class Meta:
        verbose_name_plural = "Categories"

    def __str__(self):
        return self.name


class Supplier(models.Model):
    name = models.CharField(max_length=200, unique=True)
    contact_name = models.CharField(max_length=100, blank=True, null=True)
    email = models.EmailField(blank=True, null=True)
    phone = models.CharField(max_length=20, blank=True, null=True)
    address = models.TextField(blank=True, null=True)

    def __str__(self):
        return self.name


class Warehouse(models.Model):
    name = models.CharField(max_length=100, unique=True)
    location = models.CharField(max_length=250, blank=True, null=True)
    capacity = models.PositiveIntegerField(help_text="Maximum units this warehouse can hold")

    def __str__(self):
        return self.name

    @property
    def current_total_stock(self):
        return self.stocks.aggregate(total=models.Sum('quantity'))['total'] or 0


class Product(models.Model):
    sku = models.CharField(max_length=50, unique=True, verbose_name="SKU")
    name = models.CharField(max_length=200)
    description = models.TextField(blank=True, null=True)
    price = models.DecimalField(max_digits=10, decimal_places=2)
    category = models.ForeignKey(Category, on_delete=models.SET_NULL, null=True, related_name="products")
    min_stock_level = models.PositiveIntegerField(default=10, help_text="Alert if stock falls below this level")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.name} ({self.sku})"

    @property
    def total_quantity(self):
        return self.stocks.aggregate(total=models.Sum('quantity'))['total'] or 0


class ProductStock(models.Model):
    product = models.ForeignKey(Product, on_delete=models.CASCADE, related_name="stocks")
    warehouse = models.ForeignKey(Warehouse, on_delete=models.CASCADE, related_name="stocks")
    quantity = models.IntegerField(default=0)

    class Meta:
        unique_together = ('product', 'warehouse')

    def __str__(self):
        return f"{self.product.sku} at {self.warehouse.name}: {self.quantity}"

    def save(self, *args, **kwargs):
        super().save(*args, **kwargs)
        # Broadcast stock update
        try:
            from .websocket_utils import broadcast_websocket_event
            broadcast_websocket_event('STOCK_UPDATED', {
                'product_id': self.product.id,
                'sku': self.product.sku,
                'name': self.product.name,
                'warehouse_id': self.warehouse.id,
                'warehouse_name': self.warehouse.name,
                'quantity': self.quantity
            })
            if self.quantity <= self.product.min_stock_level:
                broadcast_websocket_event('LOW_STOCK_ALERT', {
                    'product_id': self.product.id,
                    'sku': self.product.sku,
                    'name': self.product.name,
                    'quantity': self.quantity,
                    'min_stock_level': self.product.min_stock_level
                })
        except Exception:
            pass


class PurchaseOrder(models.Model):
    STATUS_CHOICES = [
        ('PENDING', 'Pending Approval'),
        ('APPROVED', 'Approved'),
        ('RECEIVED', 'Received / Completed'),
        ('CANCELLED', 'Cancelled'),
    ]

    order_number = models.CharField(max_length=50, unique=True)
    supplier = models.ForeignKey(Supplier, on_delete=models.PROTECT, related_name="purchase_orders")
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='PENDING')
    total_amount = models.DecimalField(max_digits=12, decimal_places=2, default=0.00)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.order_number

    def clean(self):
        super().clean()
        if self.status == 'RECEIVED' and self.pk:
            if not self.items.exists():
                raise ValidationError("Cannot receive a Purchase Order with no items.")

    def save(self, *args, **kwargs):
        self.clean()
        
        is_receiving = False
        if self.pk:
            old_po = PurchaseOrder.objects.get(pk=self.pk)
            if old_po.status != 'RECEIVED' and self.status == 'RECEIVED':
                is_receiving = True
        elif self.status == 'RECEIVED':
            is_receiving = True

        with transaction.atomic():
            super().save(*args, **kwargs)
            if is_receiving:
                self.process_receiving()

            # Broadcast PO status change
            try:
                from .websocket_utils import broadcast_websocket_event
                broadcast_websocket_event('PO_STATUS_CHANGED', {
                    'order_id': self.id,
                    'order_number': self.order_number,
                    'status': self.status,
                    'total_amount': float(self.total_amount)
                })
            except Exception:
                pass

    def process_receiving(self):
        warehouse = Warehouse.objects.first()
        if not warehouse:
            warehouse = Warehouse.objects.create(name="Default Warehouse", capacity=10000)

        system_user = User.objects.filter(is_superuser=True).first()
        if not system_user:
            system_user = User.objects.filter(username="system").first()
            if not system_user:
                system_user = User.objects.create_user(username="system", email="system@inventory.com")

        for item in self.items.all():
            StockTransaction.objects.create(
                product=item.product,
                warehouse=warehouse,
                type='IN',
                quantity=item.quantity,
                reference_id=f"PO_{self.order_number}",
                user=system_user
            )


class PurchaseOrderItem(models.Model):
    purchase_order = models.ForeignKey(PurchaseOrder, on_delete=models.CASCADE, related_name="items")
    product = models.ForeignKey(Product, on_delete=models.PROTECT, related_name="po_items")
    quantity = models.PositiveIntegerField()
    unit_price = models.DecimalField(max_digits=10, decimal_places=2)

    def __str__(self):
        return f"{self.quantity} x {self.product.name} in {self.purchase_order.order_number}"

    def save(self, *args, **kwargs):
        super().save(*args, **kwargs)
        po = self.purchase_order
        total = sum(item.quantity * item.unit_price for item in po.items.all())
        po.total_amount = total
        PurchaseOrder.objects.filter(pk=po.pk).update(total_amount=total)


class StockTransaction(models.Model):
    TRANSACTION_TYPES = [
        ('IN', 'Stock In (Restock/Purchase)'),
        ('OUT', 'Stock Out (Sale/Usage)'),
        ('TRANSFER', 'Warehouse Transfer'),
        ('ADJUSTMENT', 'Stock Adjustment (Audit/Loss)'),
    ]

    product = models.ForeignKey(Product, on_delete=models.CASCADE, related_name="transactions")
    warehouse = models.ForeignKey(Warehouse, on_delete=models.CASCADE, related_name="transactions")
    type = models.CharField(max_length=20, choices=TRANSACTION_TYPES)
    quantity = models.IntegerField(help_text="Positive number.")
    reference_id = models.CharField(max_length=100, blank=True, null=True)
    user = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name="transactions")
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.type} - {self.quantity} x {self.product.sku} at {self.warehouse.name}"

    def save(self, *args, **kwargs):
        if self.quantity <= 0:
            raise ValidationError("Quantity must be positive.")

        with transaction.atomic():
            stock, created = ProductStock.objects.get_or_create(
                product=self.product,
                warehouse=self.warehouse,
                defaults={'quantity': 0}
            )

            if self.type in ['IN', 'ADJUSTMENT']:
                stock.quantity += self.quantity
            elif self.type == 'OUT':
                if stock.quantity < self.quantity:
                    raise ValidationError(f"Insufficient stock at {self.warehouse.name}. Available: {stock.quantity}")
                stock.quantity -= self.quantity
            elif self.type == 'TRANSFER':
                if stock.quantity < self.quantity:
                    raise ValidationError(f"Insufficient stock to transfer from {self.warehouse.name}. Available: {stock.quantity}")
                stock.quantity -= self.quantity

            stock.save()
            super().save(*args, **kwargs)
