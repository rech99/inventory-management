from django.core.management.base import BaseCommand
from django.contrib.auth.models import User
from django.db import transaction
from inventory.models import Category, Supplier, Warehouse, Product, ProductStock, PurchaseOrder, PurchaseOrderItem, StockTransaction

class Command(BaseCommand):
    help = "Seed database with initial categories, suppliers, warehouses, products, and transactions."

    def handle(self, *args, **options):
        self.stdout.write("Starting database seeding...")
        
        with transaction.atomic():
            # 1. Create Superuser (Admin)
            admin_user, created = User.objects.get_or_create(
                username="admin",
                defaults={
                    "email": "admin@inventory.com",
                    "first_name": "System",
                    "last_name": "Admin",
                    "is_staff": True,
                    "is_superuser": True
                }
            )
            if created:
                admin_user.set_password("adminpass")
                admin_user.save()
                self.stdout.write("Superuser 'admin' created with password 'adminpass'")
            else:
                self.stdout.write("Superuser 'admin' already exists")

            # Create system user if it doesn't exist
            system_user, created = User.objects.get_or_create(
                username="system",
                defaults={
                    "email": "system@inventory.com",
                    "is_staff": False,
                    "is_superuser": False
                }
            )
            if created:
                system_user.set_password("systempass")
                system_user.save()

            # 2. Create Categories
            cat_elec, _ = Category.objects.get_or_create(name="Electronics", defaults={"description": "Devices, gadgets, and hardware components"})
            cat_furn, _ = Category.objects.get_or_create(name="Furniture", defaults={"description": "Desks, chairs, filing cabinets, etc."})
            cat_supp, _ = Category.objects.get_or_create(name="Office Supplies", defaults={"description": "Paper, pens, envelopes, and binders"})
            self.stdout.write("Categories seeded.")

            # 3. Create Suppliers
            sup_global, _ = Supplier.objects.get_or_create(
                name="Global Tech Inc",
                defaults={"contact_name": "Alice Johnson", "email": "alice@globaltech.com", "phone": "123-456-7890", "address": "123 Silicon Valley Road"}
            )
            sup_apex, _ = Supplier.objects.get_or_create(
                name="Apex Furniture Ltd",
                defaults={"contact_name": "Bob Miller", "email": "bob@apexfurniture.com", "phone": "987-654-3210", "address": "456 Oakwood Avenue"}
            )
            sup_office, _ = Supplier.objects.get_or_create(
                name="Office World Co",
                defaults={"contact_name": "Charlie Davis", "email": "charlie@officeworld.com", "phone": "555-019-2834", "address": "789 Stationery Lane"}
            )
            self.stdout.write("Suppliers seeded.")

            # 4. Create Warehouses
            wh_main, _ = Warehouse.objects.get_or_create(
                name="Main Warehouse",
                defaults={"location": "North Industrial Zone, Building A", "capacity": 10000}
            )
            wh_depot, _ = Warehouse.objects.get_or_create(
                name="Secondary Depot",
                defaults={"location": "Eastside Logistics Park, Bay 3", "capacity": 3000}
            )
            self.stdout.write("Warehouses seeded.")

            # 5. Create Products
            products_data = [
                ("ELEC-001", "Wireless Optical Mouse", "2.4Ghz wireless mouse with nano receiver", 25.00, cat_elec, 15),
                ("ELEC-002", "Mechanical Keyboard", "RGB backlit clicky switch typing keyboard", 75.00, cat_elec, 10),
                ("ELEC-003", "Full HD Monitor 27\"", "1085p IPS monitor with HDMI & DisplayPort", 185.00, cat_elec, 8),
                ("FURN-001", "Ergonomic Office Chair", "High back mesh chair with lumbar support and armrests", 199.99, cat_furn, 5),
                ("FURN-002", "Standing Desk 140x70", "Electric height adjustable desk, maple top", 320.00, cat_furn, 4),
                ("OFFC-001", "A4 Printing Paper Box", "Box of 5 reams of high brightness white print paper", 18.50, cat_supp, 20),
                ("OFFC-002", "Gel Pen Box (12-pack)", "Black ink premium smooth gel pens", 12.00, cat_supp, 12),
            ]

            products = {}
            for sku, name, desc, price, cat, min_stock in products_data:
                product, created = Product.objects.get_or_create(
                    sku=sku,
                    defaults={
                        "name": name,
                        "description": desc,
                        "price": price,
                        "category": cat,
                        "min_stock_level": min_stock
                    }
                )
                products[sku] = product
            self.stdout.write("Products seeded.")

            # 6. Create Initial Stock levels (via transactions so audit trail remains accurate)
            # We'll do this only if there are no transactions yet
            if not StockTransaction.objects.exists():
                initial_transactions = [
                    # Main Warehouse Stocks
                    (products["ELEC-001"], wh_main, "IN", 120, "INIT_STOCK_IN"),
                    (products["ELEC-002"], wh_main, "IN", 45, "INIT_STOCK_IN"),
                    (products["ELEC-003"], wh_main, "IN", 15, "INIT_STOCK_IN"),
                    (products["FURN-001"], wh_main, "IN", 12, "INIT_STOCK_IN"),
                    (products["FURN-002"], wh_main, "IN", 6, "INIT_STOCK_IN"),
                    (products["OFFC-001"], wh_main, "IN", 80, "INIT_STOCK_IN"),
                    
                    # Depot Stocks
                    (products["ELEC-001"], wh_depot, "IN", 30, "INIT_STOCK_IN"),
                    (products["OFFC-001"], wh_depot, "IN", 10, "INIT_STOCK_IN"),
                    (products["OFFC-002"], wh_depot, "IN", 5, "INIT_STOCK_IN"),  # Elec-002/003 and Furn are low/absent on Depot
                ]

                # Some OUT transactions to show flow
                out_transactions = [
                    (products["ELEC-001"], wh_main, "OUT", 12, "INV-2026-001"),
                    (products["ELEC-002"], wh_main, "OUT", 5, "INV-2026-002"),
                    (products["OFFC-001"], wh_main, "OUT", 15, "INV-2026-003"),
                ]

                for product, warehouse, tx_type, qty, ref in initial_transactions + out_transactions:
                    StockTransaction.objects.create(
                        product=product,
                        warehouse=warehouse,
                        type=tx_type,
                        quantity=qty,
                        reference_id=ref,
                        user=admin_user
                    )
                self.stdout.write("Initial stock transaction logs seeded.")

            # 7. Create Purchase Orders
            # A completed PO (already received)
            po_received_number = "PO-2026-0001"
            if not PurchaseOrder.objects.filter(order_number=po_received_number).exists():
                po_rec = PurchaseOrder.objects.create(
                    order_number=po_received_number,
                    supplier=sup_global,
                    status='RECEIVED',
                )
                PurchaseOrderItem.objects.create(purchase_order=po_rec, product=products["ELEC-001"], quantity=50, unit_price=20.00)
                PurchaseOrderItem.objects.create(purchase_order=po_rec, product=products["ELEC-002"], quantity=20, unit_price=60.00)
                self.stdout.write("Received Purchase Order seeded (and stocks automatically processed).")

            # A pending PO
            po_pending_number = "PO-2026-0002"
            if not PurchaseOrder.objects.filter(order_number=po_pending_number).exists():
                po_pend = PurchaseOrder.objects.create(
                    order_number=po_pending_number,
                    supplier=sup_apex,
                    status='PENDING',
                )
                PurchaseOrderItem.objects.create(purchase_order=po_pend, product=products["FURN-001"], quantity=10, unit_price=135.00)
                PurchaseOrderItem.objects.create(purchase_order=po_pend, product=products["FURN-002"], quantity=5, unit_price=250.00)
                self.stdout.write("Pending Purchase Order seeded.")

        self.stdout.write(self.style.SUCCESS("Database seeding completed successfully!"))
