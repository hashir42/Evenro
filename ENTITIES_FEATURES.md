# 🏢 Enhanced Venues/Branches Features

## Overview
The Entities (Venues/Branches) module has been significantly enhanced with advanced features for multi-location vendor management.

---

## ✨ New Features

### 1. 📍 **Google Maps Integration**
- **Location Coordinates**: Add latitude and longitude for precise location tracking
- **View on Maps**: One-click button to open location in Google Maps
- **Automatic Fallback**: If coordinates aren't available, uses full address for Maps search
- **Benefits**: 
  - Clients can easily find your venue
  - Display venue on custom maps
  - Calculate distances and directions

**How to Use:**
1. Edit an entity
2. Scroll to "Location & Maps" section
3. Enter latitude and longitude (e.g., 28.6139, 77.2090)
4. Save and click the Map icon to view on Google Maps

---

### 2. 💰 **Custom Pricing & Tax Rules Per Branch**
- **Branch-Specific Pricing**: Set different base prices for each location
- **Custom Tax Rates**: Configure tax rates per entity (useful for different states/regions)
- **Pricing Rules Engine**: Database support for:
  - Weekday vs Weekend pricing
  - Peak season vs Off-peak pricing
  - Date-based pricing rules
  - Custom pricing modifiers (percentage or fixed amount)

**Database Tables:**
- `entity_pricing_rules`: Stores all pricing rules
- Fields: rule_name, rule_type, price_modifier, modifier_type, date ranges, days_of_week

**How to Use:**
1. Edit an entity
2. Enable "Custom Pricing"
3. Set base price (e.g., ₹50,000)
4. Set custom tax rate (e.g., 18%)
5. Pricing rules can be added via database or future UI

**Example Use Cases:**
- Wedding hall charges more on weekends
- Studio has peak season (Nov-Feb) premium pricing
- Different tax rates for venues in different states

---

### 3. ⏰ **Live Availability Sync**
- **Real-time Status Tracking**: Know which venues are available, busy, or under maintenance
- **Automatic Updates**: When a booking is confirmed, entity availability updates automatically
- **Multi-location Management**: View availability across all your venues at a glance
- **Time-slot Based**: Track availability by date and time slots

**Database Tables:**
- `entity_availability`: Tracks availability calendar
- Automatic triggers update when bookings are created/cancelled

**Availability Statuses:**
- 🟢 **Available**: Ready for bookings
- 🟡 **Busy**: Currently occupied
- 🔴 **Maintenance**: Under repair/cleaning

**How it Works:**
1. Set entity availability status in the entity form
2. When a booking is confirmed, the system automatically marks the entity as "booked" for that date/time
3. When booking is cancelled, availability is restored
4. View status badges on entity cards

---

### 4. 👥 **Staff Assignment Per Branch**
- **Multi-branch Staff Management**: Assign staff members to specific locations
- **Role-based Assignment**: Assign roles (manager, staff, coordinator) per entity
- **Flexible Assignment**: Staff can be assigned to multiple branches
- **Track Assignment History**: Know when staff was assigned

**Database Table:**
- `entity_staff`: Links staff to entities with roles

**Use Cases:**
- Assign a manager to each branch
- Track which staff work at which location
- Coordinate multi-location events
- Generate location-based staff reports

**How to Use:**
- Future UI will allow staff assignment
- Currently managed via database
- Staff relationships tracked with RLS policies

---

## 🗄️ Database Schema

### New Tables Created:

#### `entity_staff`
```sql
- entity_id (FK to entities)
- user_id (FK to users)
- role (manager/staff/coordinator)
- assigned_date
- is_active
```

#### `entity_pricing_rules`
```sql
- entity_id (FK to entities)
- rule_name
- rule_type (weekday/weekend/peak_season/etc)
- price_modifier (amount)
- modifier_type (percentage/fixed)
- start_date, end_date
- days_of_week
- is_active
```

#### `entity_availability`
```sql
- entity_id (FK to entities)
- date
- time_slot_start, time_slot_end
- status (available/booked/blocked/maintenance)
- booking_id (FK to bookings)
- notes
```

### New Entity Columns:
- `latitude` / `longitude` - GPS coordinates
- `custom_tax_rate` - Branch-specific tax percentage
- `custom_pricing_enabled` - Toggle custom pricing
- `base_price` - Default venue price
- `availability_status` - Real-time status indicator

---

## 🎨 UI Enhancements

### Entity Cards Now Show:
- ⏰ Availability status badge (Available/Busy/Maintenance)
- 💰 Base price (if custom pricing enabled)
- 📍 Map view button (if location data available)
- 🏷️ Tax rate information

### Enhanced Form:
- Organized sections with clear headings
- Conditional fields (pricing only shows when enabled)
- Number inputs with proper step values
- Visual separation between feature groups

---

## 🚀 Benefits for Multi-Location Vendors

### For Wedding Halls:
- Different pricing for different halls
- Track which hall is booked when
- Assign staff to specific halls
- Show clients exact location on map

### For Photography Studios:
- Studio-specific pricing
- Equipment availability tracking
- Staff assignment per studio
- Client navigation via maps

### For Event Planners:
- Manage multiple venue partnerships
- Track venue availability in real-time
- Custom pricing per venue
- Coordinate staff across locations

---

## 📊 Future Enhancements

### Planned Features:
1. **Visual Availability Calendar**: Grid view of all entities' availability
2. **Staff Assignment UI**: Drag-and-drop staff assignment interface
3. **Pricing Rules UI**: User-friendly pricing rule builder
4. **Analytics Dashboard**: Utilization rates per entity
5. **Capacity Management**: Real-time capacity tracking
6. **Embedded Maps**: Show all venues on a single map
7. **Route Optimization**: Suggest optimal routes for multi-venue events

---

## 🔐 Security

All new tables have Row Level Security (RLS) enabled:
- Vendors can only view/manage their own entities
- Staff can only see entities they're assigned to
- Pricing rules are private per vendor
- Availability data is vendor-specific

---

## 📝 Migration Files

1. **20251014230000_enhance_entities.sql**: Main enhancement migration
   - Adds all new tables and columns
   - Creates triggers for automatic availability updates
   - Sets up RLS policies
   - Creates performance indexes

---

## 🎯 How to Apply

1. **Run the migration**:
   ```sql
   -- Apply the migration file in Supabase SQL Editor
   -- File: supabase/migrations/20251014230000_enhance_entities.sql
   ```

2. **Update your app**:
   - The Entities.tsx page is already updated
   - Features are ready to use immediately

3. **Test the features**:
   - Create/edit an entity with coordinates
   - Enable custom pricing
   - Set availability status
   - Click the map icon to view on Google Maps

---

## 💡 Tips & Best Practices

1. **Get accurate coordinates**: Use Google Maps to get exact lat/long
2. **Set realistic base prices**: Consider all costs before setting base price
3. **Update availability regularly**: Keep status current for accurate booking
4. **Use pricing rules wisely**: Don't create conflicting rules
5. **Assign staff appropriately**: Match skills to venue requirements

---

## 🐛 Troubleshooting

**Map button not showing?**
- Ensure latitude/longitude OR address is filled

**Availability not updating?**
- Check that booking has entity_id set
- Verify booking status is 'confirmed' or 'pending'

**Custom pricing not visible?**
- Make sure "Enable Custom Pricing" is toggled ON

---

## 📞 Support

For issues or feature requests related to Entities management, check:
1. Database migration has been applied
2. RLS policies are active
3. Form data is saving correctly (check browser console)

---

**Last Updated**: October 14, 2025
**Version**: 2.0.0
**Module**: Venues & Branches (Entities)
