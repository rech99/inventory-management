from django.test import TestCase
from django.contrib.auth.models import User
from .models import Category, Product, Warehouse

class InventoryModelTest(TestCase):
    def setUp(self):
        self.category = Category.objects.create(name="Electronics", description="Gadgets")
        self.warehouse = Warehouse.objects.create(name="Central", capacity=1000)
        self.product = Product.objects.create(
            sku="ELEC-001",
            name="Smartphone",
            price=299.99,
            category=self.category,
            min_stock_level=5
        )

    def test_category_creation(self):
        self.assertEqual(self.category.name, "Electronics")
        self.assertEqual(str(self.category), "Electronics")

    def test_warehouse_creation(self):
        self.assertEqual(self.warehouse.name, "Central")
        self.assertEqual(self.warehouse.capacity, 1000)

    def test_product_creation(self):
        self.assertEqual(self.product.sku, "ELEC-001")
        self.assertEqual(self.product.name, "Smartphone")
        self.assertEqual(float(self.product.price), 299.99)
