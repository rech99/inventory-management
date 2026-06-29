from django.core.management.base import BaseCommand
from django.contrib.auth.models import User
from django.db import transaction
from inventory.models import Category, Supplier, Warehouse, Product, ProductStock, PurchaseOrder, PurchaseOrderItem, StockTransaction

class Command(BaseCommand):
    help = "Reset and seed database with test users, products, warehouses, transactions, and purchase orders."

    def handle(self, *args, **options):
        self.stdout.write("Initializing database reset and seeding...")
        
        with transaction.atomic():
            # 1. Clear Existing Data (Ensures repeat execution resets db cleanly)
            self.stdout.write("Clearing existing tables...")
            StockTransaction.objects.all().delete()
            ProductStock.objects.all().delete()
            PurchaseOrderItem.objects.all().delete()
            PurchaseOrder.objects.all().delete()
            Product.objects.all().delete()
            Warehouse.objects.all().delete()
            Supplier.objects.all().delete()
            Category.objects.all().delete()
            
            # Remove seeded users to avoid duplicate key errors
            User.objects.filter(username__in=["admin", "manager", "staff", "system"]).delete()

            # 2. Create Test Users
            self.stdout.write("Seeding test users...")
            
            # Admin User
            admin_user = User.objects.create_user(
                username="admin",
                email="admin@inventory.com",
                first_name="System",
                last_name="Administrator",
                is_staff=True,
                is_superuser=True
            )
            admin_user.set_password("adminpass")
            admin_user.save()
            self.stdout.write("Created User: admin / adminpass (Superuser)")

            # Manager User
            manager_user = User.objects.create_user(
                username="manager",
                email="manager@inventory.com",
                first_name="Warehouse",
                last_name="Manager",
                is_staff=True,
                is_superuser=False
            )
            manager_user.set_password("managerpass")
            manager_user.save()
            self.stdout.write("Created User: manager / managerpass (Staff/Manager)")

            # Staff Auditor User
            staff_user = User.objects.create_user(
                username="staff",
                email="staff@inventory.com",
                first_name="Inventory",
                last_name="Auditor",
                is_staff=True,
                is_superuser=False
            )
            staff_user.set_password("staffpass")
            staff_user.save()
            self.stdout.write("Created User: staff / staffpass (Staff/Auditor)")

            # System User (Used for automated actions like receiving POs)
            system_user = User.objects.create_user(
                username="system",
                email="system@inventory.com",
                first_name="System",
                last_name="Automator"
            )
            system_user.set_password("systempass")
            system_user.save()

            # 3. Create Categories
            self.stdout.write("Seeding categories...")
            cat_elec = Category.objects.create(name="Electronics", description="Smartphones, keyboards, monitors, and chips")
            cat_furn = Category.objects.create(name="Furniture", description="Ergonomic desks, chairs, cabinets, and warehouse shelves")
            cat_supp = Category.objects.create(name="Office Supplies", description="A4 papers, gel pens, binders, and calculators")
            cat_pack = Category.objects.create(name="Packaging Material", description="Cardboard boxes, shipping tape, and bubble wrap")

            # 4. Create Suppliers
            self.stdout.write("Seeding suppliers...")
            sup_global = Supplier.objects.create(
                name="Global Tech Imports",
                contact_name="Alice Johnson",
                email="orders@globaltech.com",
                phone="+1-555-987-6543",
                address="120 Silicon Way, San Jose, CA"
            )
            sup_apex = Supplier.objects.create(
                name="Apex Furniture Solutions",
                contact_name="Marcus Aurelius",
                email="sales@apexfurniture.com",
                phone="+1-555-123-4567",
                address="456 Industrial Parkway, Grand Rapids, MI"
            )
            sup_office = Supplier.objects.create(
                name="Office Distribution Co",
                contact_name="Charlie Davis",
                email="charlie@officedist.com",
                phone="+1-555-789-0123",
                address="789 Logistics Blvd, Atlanta, GA"
            )

            # 5. Create Warehouses
            self.stdout.write("Seeding warehouses...")
            wh_main = Warehouse.objects.create(
                name="Main Central Warehouse",
                location="Logistics Hub Bay A, Chicago, IL",
                capacity=15000
            )
            wh_east = Warehouse.objects.create(
                name="East Coast Depot",
                location="Port Terminal Building 4, Newark, NJ",
                capacity=5000
            )

            # 6. Create Products
            self.stdout.write("Seeding products...")
            products = {
                "ELEC-001": Product.objects.create(sku="ELEC-001", name="Wireless Optical Mouse", description="High precision 2.4Ghz wireless mouse", price=24.50, category=cat_elec, min_stock_level=20),
                "ELEC-002": Product.objects.create(sku="ELEC-002", name="Mechanical Keyboard Pro", description="RGB backlit clicky switch typing keyboard", price=85.00, category=cat_elec, min_stock_level=12),
                "ELEC-003": Product.objects.create(sku="ELEC-003", name="IPS Monitor 27\"", description="IPS panel 1440p refresh rate monitor", price=220.00, category=cat_elec, min_stock_level=6),
                "ELEC-004": Product.objects.create(sku="ELEC-004", name="Type-C Multi-Hub Adapter", description="8-in-1 USB-C docking station", price=45.00, category=cat_elec, min_stock_level=15),
                
                "FURN-001": Product.objects.create(sku="FURN-001", name="Ergonomic Mesh Chair", description="High-back office chair with lumbar support", price=179.99, category=cat_furn, min_stock_level=8),
                "FURN-002": Product.objects.create(sku="FURN-002", name="Adjustable Standing Desk", description="Electric dual-motor standing desk frame", price=349.00, category=cat_furn, min_stock_level=5),
                "FURN-003": Product.objects.create(sku="FURN-003", name="Steel Storage Cabinet", description="3-shelf heavy duty lockable steel locker", price=125.00, category=cat_furn, min_stock_level=4),

                "OFFC-001": Product.objects.create(sku="OFFC-001", name="White Print Paper Box", description="Box containing 5 reams of standard A4 print paper", price=19.99, category=cat_supp, min_stock_level=25),
                "OFFC-002": Product.objects.create(sku="OFFC-002", name="Premium Gel Pens (12-pack)", description="Black gel ink smooth-write pens", price=8.50, category=cat_supp, min_stock_level=15),
                
                "PACK-001": Product.objects.create(sku="PACK-001", name="Medium Shipping Boxes (25-pack)", description="12x12x12 double wall cardboard shipping boxes", price=35.00, category=cat_pack, min_stock_level=10),
            }

            # 7. Seed Initial Stock Levels (via transactions to build correct history log)
            self.stdout.write("Seeding stock transactions history...")
            
            # Initial IN transactions
            initial_stock_ins = [
                # Main Central Warehouse (High levels)
                (products["ELEC-001"], wh_main, 150, "INIT_IN"),
                (products["ELEC-002"], wh_main, 60, "INIT_IN"),
                (products["ELEC-003"], wh_main, 18, "INIT_IN"),
                (products["ELEC-004"], wh_main, 80, "INIT_IN"),
                (products["FURN-001"], wh_main, 14, "INIT_IN"),
                (products["FURN-002"], wh_main, 8, "INIT_IN"),
                (products["FURN-003"], wh_main, 5, "INIT_IN"),
                (products["OFFC-001"], wh_main, 100, "INIT_IN"),
                (products["OFFC-002"], wh_main, 12, "INIT_IN"),  # Set this low to trigger alert immediately!
                (products["PACK-001"], wh_main, 40, "INIT_IN"),

                # East Coast Depot (Lower levels, regional storage)
                (products["ELEC-001"], wh_east, 30, "INIT_IN"),
                (products["ELEC-004"], wh_east, 15, "INIT_IN"),
                (products["FURN-001"], wh_east, 3, "INIT_IN"),
                (products["OFFC-001"], wh_east, 20, "INIT_IN"),
            ]

            for product, warehouse, qty, ref in initial_stock_ins:
                StockTransaction.objects.create(
                    product=product,
                    warehouse=warehouse,
                    type='IN',
                    quantity=qty,
                    reference_id=ref,
                    user=manager_user
                )

            # Seed some Sales/OUT transactions to show movement in lists
            sales_txs = [
                (products["ELEC-001"], wh_main, 12, "INV-2026-901"),
                (products["ELEC-002"], wh_main, 8, "INV-2026-902"),
                (products["ELEC-004"], wh_main, 15, "INV-2026-903"),
                (products["FURN-002"], wh_main, 2, "INV-2026-904"),
                (products["OFFC-001"], wh_main, 20, "INV-2026-905"),
                (products["ELEC-001"], wh_east, 5, "INV-2026-906"),
            ]

            for product, warehouse, qty, ref in sales_txs:
                StockTransaction.objects.create(
                    product=product,
                    warehouse=warehouse,
                    type='OUT',
                    quantity=qty,
                    reference_id=ref,
                    user=staff_user
                )

            # Seed a Transfer transaction pair (Main Central Warehouse -> East Coast Depot)
            # Transfer 10 Wireless Optical Mouse (ELEC-001) from wh_main to wh_east
            StockTransaction.objects.create(
                product=products["ELEC-001"],
                warehouse=wh_main,
                type='TRANSFER',
                quantity=10,
                reference_id=f"TRANSFER_TO_{wh_east.id}",
                user=manager_user
            )
            StockTransaction.objects.create(
                product=products["ELEC-001"],
                warehouse=wh_east,
                type='IN',
                quantity=10,
                reference_id=f"TRANSFER_FROM_{wh_main.id}",
                user=manager_user
            )

            # 8. Seed Purchase Orders in Different States
            self.stdout.write("Seeding purchase orders...")

            # PO 1: Already RECEIVED (fully processed, added to stock during model save)
            po1 = PurchaseOrder.objects.create(
                order_number="PO-2026-0001",
                supplier=sup_global,
                status="RECEIVED"
            )
            # Add items (triggers save recalculations)
            PurchaseOrderItem.objects.create(purchase_order=po1, product=products["ELEC-001"], quantity=50, unit_price=20.00)
            PurchaseOrderItem.objects.create(purchase_order=po1, product=products["ELEC-002"], quantity=20, unit_price=65.00)

            # PO 2: APPROVED (Ready to receive on floor/mobile)
            po2 = PurchaseOrder.objects.create(
                order_number="PO-2026-0002",
                supplier=sup_apex,
                status="APPROVED"
            )
            PurchaseOrderItem.objects.create(purchase_order=po2, product=products["FURN-001"], quantity=10, unit_price=135.00)
            PurchaseOrderItem.objects.create(purchase_order=po2, product=products["FURN-002"], quantity=5, unit_price=260.00)

            # PO 3: PENDING Approval (Drafting state, waiting for Web actions)
            po3 = PurchaseOrder.objects.create(
                order_number="PO-2026-0003",
                supplier=sup_office,
                status="PENDING"
            )
            PurchaseOrderItem.objects.create(purchase_order=po3, product=products["OFFC-001"], quantity=50, unit_price=15.00)
            PurchaseOrderItem.objects.create(purchase_order=po3, product=products["OFFC-002"], quantity=30, unit_price=6.00)

            # PO 4: CANCELLED (Voided order)
            po4 = PurchaseOrder.objects.create(
                order_number="PO-2026-0004",
                supplier=sup_global,
                status="CANCELLED"
            )
            PurchaseOrderItem.objects.create(purchase_order=po4, product=products["ELEC-003"], quantity=5, unit_price=180.00)

        self.stdout.write(self.style.SUCCESS("SQLite Database has been reset and seeded successfully!"))
