# AddressSelector Component

A comprehensive address selection component with cascading dropdowns for Emirate, Region, and Area selection. This component handles the data fetching and filtering logic automatically.

## Features

- **Cascading Selection**: Emirate → Region → Area with automatic filtering
- **Data Fetching**: Automatically loads data from API endpoints
- **Flexible Layout**: Supports both horizontal and vertical layouts
- **Customizable**: Configurable labels, placeholders, and column spans
- **Form Integration**: Works seamlessly with Formily and Ant Design forms
- **Loading States**: Shows loading indicators during data fetching
- **Search Support**: Built-in search functionality for all dropdowns

## Usage

### Basic Usage

```tsx
import AddressSelector, { AddressSelectorValue } from '@/components/common/AddressSelector';

const [address, setAddress] = useState<AddressSelectorValue>({});

<AddressSelector
  value={address}
  onChange={setAddress}
/>
```

### With Custom Configuration

```tsx
<AddressSelector
  value={address}
  onChange={setAddress}
  placeholder={{
    emirate: "Choose Emirate",
    region: "Choose Region",
    area: "Choose Area"
  }}
  labels={{
    emirate: "Emirate",
    region: "Region", 
    area: "Area"
  }}
  required={{
    emirate: true,
    region: true,
    area: false
  }}
  layout="vertical"
  disabled={false}
/>
```

### In Formily Forms

```tsx
import { Field } from "@formily/react";
import { FormItem } from "@formily/antd";

<Field
  name="address"
  decorator={[FormItem]}
  validator={(value) => {
    if (!value || !value.emirate || !value.region || !value.area) {
      return "Please select complete address information";
    }
    return "";
  }}
>
  <AddressSelector />
</Field>
```

## Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `value` | `AddressSelectorValue` | `{}` | Current selected values |
| `onChange` | `(value: AddressSelectorValue) => void` | - | Callback when selection changes |
| `disabled` | `boolean` | `false` | Disable all selectors |
| `placeholder` | `object` | See below | Placeholder text for each selector |
| `labels` | `object` | See below | Label text for each selector (vertical layout) |
| `required` | `object` | `{emirate: true, region: true, area: true}` | Required validation for each field |
| `layout` | `"horizontal" \| "vertical"` | `"horizontal"` | Layout direction |
| `colSpan` | `object` | `{emirate: 8, region: 8, area: 8}` | Column spans for horizontal layout |

### Default Values

```typescript
// Default placeholders
placeholder: {
  emirate: "Select Emirate",
  region: "Select Region",
  area: "Select Area"
}

// Default labels
labels: {
  emirate: "Emirate",
  region: "Region",
  area: "Area"
}

// Default column spans (horizontal layout)
colSpan: {
  emirate: 8,
  region: 8,
  area: 8
}
```

## Data Types

```typescript
interface AddressSelectorValue {
  emirate?: number;
  region?: number;
  area?: number;
}

interface EmirateItem {
  id: number;
  nameEn: string;
  nameAr: string;
  code?: string;
}

interface RegionItem {
  id: number;
  nameEn: string;
  nameAr: string;
  emirateId: number;
  code?: string;
}

interface AreaItem {
  id: number;
  nameEn: string;
  nameAr: string;
  regionId: number;
  code?: string;
}
```

## API Integration

The component automatically calls these API endpoints:

- `GET /api/User/GetEmirateList` - Fetch all emirates
- `GET /api/User/GetRegionList` - Fetch all regions
- `GET /api/User/GetAreaList` - Fetch all areas

The filtering is done client-side for better performance after initial data load.

## Styling

The component includes CSS classes for customization:

- `.address-selector` - Main container
- `.address-selector.horizontal` - Horizontal layout
- `.address-selector.vertical` - Vertical layout
- `.address-selector-item` - Individual selector container
- `.address-selector-label` - Label styling

## Dependencies

- `@formily/react` - Form field integration
- `@formily/antd` - Form item decorator
- `antd` - Select, Row, Col components
- Custom `@/services/address` - API service functions