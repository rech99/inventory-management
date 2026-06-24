from rest_framework import serializers
from django.contrib.auth.models import User
from django.db import transaction
from .models import Category, Supplier, Warehouse, Product, ProductStock, PurchaseOrder, PurchaseOrderItem, StockTransaction

class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ('id', 'username', 'email', 'first_name', 'last_name')


class CategorySerializer(serializers.ModelSerializer):
    product_count = serializers.IntegerField(read_only=True, default=0)

    class Meta:
        model = Category
        fields = ('id', 'name', 'description', 'product_count')


class SupplierSerializer(serializers.ModelSerializer):
    class Meta:
        model = Supplier
        fields = ('id', 'name', 'contact_name', 'email', 'phone', 'address')


class WarehouseSerializer(serializers.ModelSerializer):
    current_total_stock = serializers.IntegerField(read_only=True)

    class Meta:
        model = Warehouse
        fields = ('id', 'name', 'location', 'capacity', 'current_total_stock')


class ProductStockSerializer(serializers.ModelSerializer):
    warehouse_name = serializers.CharField(source='warehouse.name', read_only=True)
    product_name = serializers.CharField(source='product.name', read_only=True)
    product_sku = serializers.CharField(source='product.sku', read_only=True)

    class Meta:
        model = ProductStock
        fields = ('id', 'product', 'product_name', 'product_sku', 'warehouse', 'warehouse_name', 'quantity')


class ProductSerializer(serializers.ModelSerializer):
    category_name = serializers.CharField(source='category.name', read_only=True)
    stocks = ProductStockSerializer(many=True, read_only=True)
    total_quantity = serializers.IntegerField(read_only=True)

    class Meta:
        model = Product
        fields = (
            'id', 'sku', 'name', 'description', 'price', 
            'category', 'category_name', 'min_stock_level', 
            'stocks', 'total_quantity', 'created_at', 'updated_at'
        )


class PurchaseOrderItemSerializer(serializers.ModelSerializer):
    product_name = serializers.CharField(source='product.name', read_only=True)
    product_sku = serializers.CharField(source='product.sku', read_only=True)

    class Meta:
        model = PurchaseOrderItem
        fields = ('id', 'product', 'product_name', 'product_sku', 'quantity', 'unit_price')


class PurchaseOrderSerializer(serializers.ModelSerializer):
    supplier_name = serializers.CharField(source='supplier.name', read_only=True)
    items = PurchaseOrderItemSerializer(many=True)

    class Meta:
        model = PurchaseOrder
        fields = ('id', 'order_number', 'supplier', 'supplier_name', 'status', 'total_amount', 'items', 'created_at', 'updated_at')
        read_only_fields = ('total_amount',)

    def create(self, validated_data):
        items_data = validated_data.pop('items')
        with transaction.atomic():
            purchase_order = PurchaseOrder.objects.create(**validated_data)
            for item_data in items_data:
                PurchaseOrderItem.objects.create(purchase_order=purchase_order, **item_data)
        return purchase_order

    def update(self, instance, validated_data):
        items_data = validated_data.pop('items', None)
        
        with transaction.atomic():
            instance.order_number = validated_data.get('order_number', instance.order_number)
            instance.supplier = validated_data.get('supplier', instance.supplier)
            instance.status = validated_data.get('status', instance.status)
            instance.save()

            if items_data is not None:
                # Simple implementation: recreate items
                instance.items.all().delete()
                for item_data in items_data:
                    PurchaseOrderItem.objects.create(purchase_order=instance, **item_data)
                
                # Force recalculate total_amount
                total = sum(item.quantity * item.unit_price for item in instance.items.all())
                instance.total_amount = total
                instance.save()

        return instance


class StockTransactionSerializer(serializers.ModelSerializer):
    product_name = serializers.CharField(source='product.name', read_only=True)
    product_sku = serializers.CharField(source='product.sku', read_only=True)
    warehouse_name = serializers.CharField(source='warehouse.name', read_only=True)
    user_name = serializers.CharField(source='user.username', read_only=True)

    class Meta:
        model = StockTransaction
        fields = (
            'id', 'product', 'product_name', 'product_sku',
            'warehouse', 'warehouse_name', 'type', 'quantity', 
            'reference_id', 'user', 'user_name', 'created_at'
        )
        read_only_fields = ('user',)


class StockTransferSerializer(serializers.Serializer):
    product = serializers.PrimaryKeyRelatedField(queryset=Product.objects.all())
    from_warehouse = serializers.PrimaryKeyRelatedField(queryset=Warehouse.objects.all())
    to_warehouse = serializers.PrimaryKeyRelatedField(queryset=Warehouse.objects.all())
    quantity = serializers.IntegerField(min_value=1)

    def validate(self, data):
        if data['from_warehouse'] == data['to_warehouse']:
            raise serializers.ValidationError("Source and target warehouses must be different.")
        
        # Check source stock
        try:
            source_stock = ProductStock.objects.get(
                product=data['product'],
                warehouse=data['from_warehouse']
            )
            if source_stock.quantity < data['quantity']:
                raise serializers.ValidationError(
                    f"Insufficient stock in {data['from_warehouse'].name}. Available: {source_stock.quantity}"
                )
        except ProductStock.DoesNotExist:
            raise serializers.ValidationError(
                f"No stock records found for product in {data['from_warehouse'].name}."
            )
        
        return data

    def save(self, user=None):
        data = self.validated_data
        product = data['product']
        from_wh = data['from_warehouse']
        to_wh = data['to_warehouse']
        qty = data['quantity']

        with transaction.atomic():
            # Create standard OUT transaction from source
            tx_out = StockTransaction.objects.create(
                product=product,
                warehouse=from_wh,
                type='TRANSFER',
                quantity=qty,
                reference_id=f"TRANSFER_TO_{to_wh.id}",
                user=user
            )

            # Create standard IN transaction to destination
            tx_in = StockTransaction.objects.create(
                product=product,
                warehouse=to_wh,
                type='IN',
                quantity=qty,
                reference_id=f"TRANSFER_FROM_{from_wh.id}",
                user=user
            )
            
        return tx_out
