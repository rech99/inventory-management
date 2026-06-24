from django.db.models import Sum, F, Count
from django.utils import timezone
from rest_framework import viewsets, permissions, status, generics
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import filters

from .models import Category, Supplier, Warehouse, Product, ProductStock, PurchaseOrder, StockTransaction
from .serializers import (
    CategorySerializer, SupplierSerializer, WarehouseSerializer, 
    ProductSerializer, ProductStockSerializer, PurchaseOrderSerializer, 
    StockTransactionSerializer, StockTransferSerializer
)

class CategoryViewSet(viewsets.ModelViewSet):
    queryset = Category.objects.annotate(product_count=Count('products')).all()
    serializer_class = CategorySerializer
    permission_classes = [permissions.IsAuthenticated]
    filter_backends = [filters.SearchFilter]
    search_fields = ['name']


class SupplierViewSet(viewsets.ModelViewSet):
    queryset = Supplier.objects.all()
    serializer_class = SupplierSerializer
    permission_classes = [permissions.IsAuthenticated]
    filter_backends = [filters.SearchFilter]
    search_fields = ['name', 'contact_name', 'email']


class WarehouseViewSet(viewsets.ModelViewSet):
    queryset = Warehouse.objects.all()
    serializer_class = WarehouseSerializer
    permission_classes = [permissions.IsAuthenticated]

    @action(detail=True, methods=['get'])
    def stock(self, request, pk=None):
        warehouse = self.get_object()
        stocks = ProductStock.objects.filter(warehouse=warehouse)
        serializer = ProductStockSerializer(stocks, many=True)
        return Response(serializer.data)


class ProductViewSet(viewsets.ModelViewSet):
    queryset = Product.objects.all()
    serializer_class = ProductSerializer
    permission_classes = [permissions.IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['category']
    search_fields = ['sku', 'name', 'description']
    ordering_fields = ['price', 'created_at', 'name']

    def get_queryset(self):
        queryset = super().get_queryset()
        # Custom filter: filter by low stock
        low_stock = self.request.query_params.get('low_stock', None)
        if low_stock == 'true':
            # Find products where total quantity < min_stock_level
            # In Django, we can annotate total_quantity
            queryset = queryset.annotate(
                total_qty=Sum('stocks__quantity')
            ).filter(total_qty__lt=F('min_stock_level'))
        return queryset


class PurchaseOrderViewSet(viewsets.ModelViewSet):
    queryset = PurchaseOrder.objects.all()
    serializer_class = PurchaseOrderSerializer
    permission_classes = [permissions.IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter]
    filterset_fields = ['status', 'supplier']
    ordering_fields = ['created_at', 'total_amount']


class StockTransactionViewSet(viewsets.ReadOnlyModelViewSet, viewsets.mixins.CreateModelMixin):
    """
    Read-only view for transaction history, with creation support (Stock In/Out).
    Update and delete are disabled to maintain the audit trail integrity.
    """
    queryset = StockTransaction.objects.all().order_by('-created_at')
    serializer_class = StockTransactionSerializer
    permission_classes = [permissions.IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter]
    filterset_fields = ['product', 'warehouse', 'type']
    search_fields = ['reference_id']

    def perform_create(self, serializer):
        # Automatically assign the logging user to the transaction
        serializer.save(user=self.request.user)


class StockTransferAPIView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, *args, **kwargs):
        serializer = StockTransferSerializer(data=request.data)
        if serializer.is_valid():
            tx_out = serializer.save(user=request.user)
            # Serialize the logged OUT transaction as confirmation
            return Response(
                StockTransactionSerializer(tx_out).data,
                status=status.HTTP_201_CREATED
            )
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class DashboardAnalyticsAPIView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, *args, **kwargs):
        # 1. Total products
        total_products = Product.objects.count()

        # 2. Net stock value: Sum of (product stock qty * product price)
        # We can calculate this by querying ProductStock and joining Product
        stock_value_query = ProductStock.objects.aggregate(
            total_value=Sum(F('quantity') * F('product__price'))
        )
        total_stock_value = stock_value_query['total_value'] or 0

        # 3. Total physical units in stock
        total_units = ProductStock.objects.aggregate(total_qty=Sum('quantity'))['total_qty'] or 0

        # 4. Low stock products count
        # A product is low stock if its sum(stock_quantity) is less than min_stock_level
        # We annotate and filter
        low_stock_products = Product.objects.annotate(
            total_qty=Sum('stocks__quantity')
        ).filter(total_qty__lt=F('min_stock_level'))
        
        low_stock_count = low_stock_products.count()
        low_stock_serialized = ProductSerializer(low_stock_products[:5], many=True).data

        # 5. Pending purchase orders count
        pending_pos = PurchaseOrder.objects.filter(status='PENDING').count()

        # 6. Recent transactions
        recent_txs = StockTransaction.objects.order_by('-created_at')[:8]
        recent_txs_serialized = StockTransactionSerializer(recent_txs, many=True).data

        # 7. Category distribution (Products per Category)
        category_distribution = Category.objects.annotate(
            item_count=Count('products')
        ).values('name', 'item_count')

        return Response({
            'metrics': {
                'total_products': total_products,
                'total_stock_value': float(total_stock_value),
                'total_units': total_units,
                'low_stock_count': low_stock_count,
                'pending_purchase_orders': pending_pos
            },
            'low_stock_items': low_stock_serialized,
            'recent_transactions': recent_txs_serialized,
            'category_distribution': list(category_distribution)
        })
