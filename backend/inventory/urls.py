from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    CategoryViewSet, SupplierViewSet, WarehouseViewSet, 
    ProductViewSet, PurchaseOrderViewSet, StockTransactionViewSet,
    StockTransferAPIView, DashboardAnalyticsAPIView
)

router = DefaultRouter()
router.register(r'categories', CategoryViewSet, basename='category')
router.register(r'suppliers', SupplierViewSet, basename='supplier')
router.register(r'warehouses', WarehouseViewSet, basename='warehouse')
router.register(r'products', ProductViewSet, basename='product')
router.register(r'purchase-orders', PurchaseOrderViewSet, basename='purchase-order')
router.register(r'transactions', StockTransactionViewSet, basename='transaction')

urlpatterns = [
    path('', include(router.urls)),
    path('stock/transfer/', StockTransferAPIView.as_view(), name='stock-transfer'),
    path('analytics/dashboard/', DashboardAnalyticsAPIView.as_view(), name='dashboard-analytics'),
]
