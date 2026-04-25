export type CategoryStyle = {
  label: string;
  hindi: string;
  icon: string;
  iconBg: string;
  iconColor: string;
  color: string;
  tint: string;
};

export const CATEGORY_STYLES: Record<string, CategoryStyle> = {
  dairy: {
    label: 'Dairy & Eggs', hindi: 'डेयरी',
    icon: '🥛',
    iconBg: '#F0DDC4', iconColor: '#A86B3C',
    color: '#A86B3C', tint: '#F0DDC4',
  },
  fruits: {
    label: 'Fruits', hindi: 'फल',
    icon: '🍎',
    iconBg: '#E6E8CF', iconColor: '#6F7A3E',
    color: '#6F7A3E', tint: '#E6E8CF',
  },
  vegetables: {
    label: 'Vegetables', hindi: 'सब्ज़ी',
    icon: '🥕',
    iconBg: '#E6E8CF', iconColor: '#6F7A3E',
    color: '#6F7A3E', tint: '#E6E8CF',
  },
  produce: {
    label: 'Fruits & Veg', hindi: 'सब्ज़ी',
    icon: '🥦',
    iconBg: '#E6E8CF', iconColor: '#6F7A3E',
    color: '#6F7A3E', tint: '#E6E8CF',
  },
  bread_bakery: {
    label: 'Bakery', hindi: 'बेकरी',
    icon: '🍞',
    iconBg: '#F2E0B0', iconColor: '#B8852A',
    color: '#B8852A', tint: '#F2E0B0',
  },
  biscuits_cookies: {
    label: 'Biscuits', hindi: 'नमकीन',
    icon: '🍪',
    iconBg: '#F2E0B0', iconColor: '#B8852A',
    color: '#B8852A', tint: '#F2E0B0',
  },
  snacks: {
    label: 'Snacks', hindi: 'नमकीन',
    icon: '🍿',
    iconBg: '#F2E0B0', iconColor: '#B8852A',
    color: '#B8852A', tint: '#F2E0B0',
  },
  beverages: {
    label: 'Chai & Drinks', hindi: 'पेय',
    icon: '☕',
    iconBg: '#E8D3DC', iconColor: '#5B2E4A',
    color: '#5B2E4A', tint: '#E8D3DC',
  },
  staples: {
    label: 'Atta, Rice, Dal', hindi: 'राशन',
    icon: '🌾',
    iconBg: '#EDD9BE', iconColor: '#8B5A2B',
    color: '#8B5A2B', tint: '#EDD9BE',
  },
  spices: {
    label: 'Masale', hindi: 'मसाले',
    icon: '🌶️',
    iconBg: '#F4D5C5', iconColor: '#C85C3C',
    color: '#C85C3C', tint: '#F4D5C5',
  },
  meat_eggs: {
    label: 'Meat & Eggs', hindi: 'अंडे',
    icon: '🥚',
    iconBg: '#F0DDC4', iconColor: '#A86B3C',
    color: '#A86B3C', tint: '#F0DDC4',
  },
  personal_care: {
    label: 'Personal Care', hindi: 'निजी',
    icon: '🧴',
    iconBg: '#D2DEE3', iconColor: '#4A6B7A',
    color: '#4A6B7A', tint: '#D2DEE3',
  },
  cleaning_household: {
    label: 'Household', hindi: 'घर का सामान',
    icon: '🧽',
    iconBg: '#DDDAC8', iconColor: '#6B6B5C',
    color: '#6B6B5C', tint: '#DDDAC8',
  },
  other: {
    label: 'Other', hindi: 'अन्य',
    icon: '🛍️',
    iconBg: '#EADFCA', iconColor: '#8A7E6E',
    color: '#8A7E6E', tint: '#EADFCA',
  },
};
