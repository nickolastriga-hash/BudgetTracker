import type MaterialIcons from '@expo/vector-icons/MaterialIcons';
import type { ComponentProps } from 'react';

type IconName = ComponentProps<typeof MaterialIcons>['name'];

// Curated MaterialIcons names for the category icon picker, grouped roughly
// by theme so neighbors in the grid feel related. `satisfies` checks every
// entry against the installed glyphmap at compile time — an unknown name
// would otherwise silently render as a blank box.
export const CATEGORY_ICONS = [
  // food & dining
  'restaurant',
  'lunch-dining',
  'dinner-dining',
  'breakfast-dining',
  'fastfood',
  'local-pizza',
  'ramen-dining',
  'bakery-dining',
  'icecream',
  'local-cafe',
  'wine-bar',
  'liquor',
  'local-grocery-store',
  'shopping-cart',
  'kitchen',
  // transport
  'directions-car',
  'local-gas-station',
  'local-parking',
  'directions-bus',
  'directions-subway',
  'train',
  'local-taxi',
  'pedal-bike',
  'flight',
  'directions-boat',
  'ev-station',
  'car-repair',
  // housing & utilities
  'home',
  'apartment',
  'cottage',
  'bolt',
  'water-drop',
  'wifi',
  'phone-iphone',
  'plumbing',
  'chair',
  'weekend',
  'yard',
  // shopping
  'shopping-bag',
  'checkroom',
  'diamond',
  'devices',
  'laptop-mac',
  'watch',
  'style',
  'redeem',
  // entertainment
  'movie',
  'theaters',
  'sports-esports',
  'music-note',
  'headset',
  'sports-basketball',
  'sports-soccer',
  'golf-course',
  'celebration',
  'nightlife',
  'casino',
  // health
  'local-hospital',
  'medication',
  'medical-services',
  'fitness-center',
  'spa',
  'self-improvement',
  'visibility',
  'psychology',
  // education
  'school',
  'menu-book',
  'auto-stories',
  'laptop',
  'science',
  // work & money
  'work',
  'savings',
  'attach-money',
  'paid',
  'account-balance',
  'account-balance-wallet',
  'credit-card',
  'receipt-long',
  'trending-up',
  'insights',
  'request-quote',
  'currency-exchange',
  'money-off',
  'point-of-sale',
  'storefront',
  'business-center',
  'real-estate-agent',
  // travel
  'luggage',
  'card-travel',
  'beach-access',
  'hotel',
  'map',
  'explore',
  'travel-explore',
  // family & pets
  'pets',
  'child-care',
  'family-restroom',
  'stroller',
  'toys',
  // gifts & giving
  'card-giftcard',
  'volunteer-activism',
  'favorite',
  'church',
  // misc
  'autorenew',
  'security',
  'shield',
  'build',
  'handyman',
  'cleaning-services',
  'local-laundry-service',
  'more-horiz',
  'category',
] as const satisfies readonly IconName[];

export const DEFAULT_CATEGORY_ICON: (typeof CATEGORY_ICONS)[number] = 'category';

// Checked in order against the category name; first keyword match wins, so
// more specific rules go first when keywords could collide.
const RULES: { keywords: string[]; icon: (typeof CATEGORY_ICONS)[number] }[] = [
  // food & dining
  { keywords: ['grocer', 'supermarket'], icon: 'local-grocery-store' },
  { keywords: ['coffee', 'cafe', 'espresso'], icon: 'local-cafe' },
  { keywords: ['pizza'], icon: 'local-pizza' },
  { keywords: ['fast food', 'burger', 'takeout', 'take out', 'take-out'], icon: 'fastfood' },
  { keywords: ['ramen', 'noodle', 'sushi'], icon: 'ramen-dining' },
  { keywords: ['bakery', 'bread', 'pastry'], icon: 'bakery-dining' },
  { keywords: ['ice cream', 'dessert', 'sweet'], icon: 'icecream' },
  { keywords: ['wine', 'bar', 'cocktail'], icon: 'wine-bar' },
  { keywords: ['alcohol', 'beer', 'liquor'], icon: 'liquor' },
  { keywords: ['breakfast', 'brunch'], icon: 'breakfast-dining' },
  { keywords: ['lunch'], icon: 'lunch-dining' },
  { keywords: ['dinner'], icon: 'dinner-dining' },
  { keywords: ['dining', 'restaurant', 'eat', 'food'], icon: 'restaurant' },
  // transport
  { keywords: ['gas', 'fuel', 'petrol'], icon: 'local-gas-station' },
  { keywords: ['charging', 'ev charge', 'electric car'], icon: 'ev-station' },
  { keywords: ['parking'], icon: 'local-parking' },
  { keywords: ['repair', 'mechanic', 'maintenance'], icon: 'car-repair' },
  { keywords: ['taxi', 'uber', 'lyft', 'rideshare', 'ride share'], icon: 'local-taxi' },
  { keywords: ['bus'], icon: 'directions-bus' },
  { keywords: ['subway', 'metro', 'transit'], icon: 'directions-subway' },
  { keywords: ['train', 'rail'], icon: 'train' },
  { keywords: ['bike', 'cycling', 'scooter'], icon: 'pedal-bike' },
  { keywords: ['flight', 'airfare', 'airline', 'plane'], icon: 'flight' },
  { keywords: ['ferry', 'boat', 'cruise'], icon: 'directions-boat' },
  { keywords: ['car', 'auto', 'vehicle', 'commute', 'drive'], icon: 'directions-car' },
  // housing & utilities
  { keywords: ['rent', 'mortgage', 'housing'], icon: 'home' },
  { keywords: ['apartment', 'condo', 'hoa'], icon: 'apartment' },
  { keywords: ['electric', 'electricity', 'power bill'], icon: 'bolt' },
  { keywords: ['water bill', 'water'], icon: 'water-drop' },
  { keywords: ['internet', 'wifi', 'broadband'], icon: 'wifi' },
  { keywords: ['phone', 'cell', 'mobile bill'], icon: 'phone-iphone' },
  { keywords: ['plumb'], icon: 'plumbing' },
  { keywords: ['furniture', 'sofa', 'couch'], icon: 'weekend' },
  { keywords: ['garden', 'lawn', 'yard'], icon: 'yard' },
  { keywords: ['home goods', 'decor', 'housewares'], icon: 'chair' },
  // shopping
  { keywords: ['clothes', 'clothing', 'apparel', 'outfit'], icon: 'checkroom' },
  { keywords: ['jewelry', 'jewellery'], icon: 'diamond' },
  { keywords: ['electronics', 'gadget', 'phone upgrade'], icon: 'devices' },
  { keywords: ['computer', 'laptop'], icon: 'laptop-mac' },
  { keywords: ['watch', 'accessor'], icon: 'watch' },
  { keywords: ['shopping', 'retail', 'store', 'mall'], icon: 'shopping-bag' },
  // entertainment
  { keywords: ['movie', 'cinema', 'theater', 'theatre'], icon: 'movie' },
  { keywords: ['game', 'gaming', 'video game'], icon: 'sports-esports' },
  { keywords: ['music', 'concert', 'spotify'], icon: 'music-note' },
  { keywords: ['podcast', 'audiobook'], icon: 'headset' },
  { keywords: ['basketball'], icon: 'sports-basketball' },
  { keywords: ['soccer', 'football'], icon: 'sports-soccer' },
  { keywords: ['golf'], icon: 'golf-course' },
  { keywords: ['party', 'celebration', 'birthday'], icon: 'celebration' },
  { keywords: ['club', 'nightlife', 'nightclub'], icon: 'nightlife' },
  { keywords: ['gambling', 'casino', 'lottery', 'bet'], icon: 'casino' },
  // health
  { keywords: ['doctor', 'hospital', 'clinic', 'checkup'], icon: 'local-hospital' },
  { keywords: ['pharmacy', 'medicine', 'prescription', 'medication'], icon: 'medication' },
  { keywords: ['dentist', 'dental', 'therapy', 'therapist'], icon: 'medical-services' },
  { keywords: ['gym', 'fitness', 'workout', 'membership'], icon: 'fitness-center' },
  { keywords: ['spa', 'massage', 'self care', 'self-care'], icon: 'spa' },
  { keywords: ['meditat', 'wellness', 'mindful'], icon: 'self-improvement' },
  { keywords: ['glasses', 'optometrist', 'vision', 'eye'], icon: 'visibility' },
  { keywords: ['mental health', 'counsel'], icon: 'psychology' },
  // education
  { keywords: ['tuition', 'school', 'college', 'university'], icon: 'school' },
  { keywords: ['book', 'textbook'], icon: 'menu-book' },
  { keywords: ['course', 'class', 'lesson'], icon: 'auto-stories' },
  { keywords: ['software', 'saas', 'app'], icon: 'laptop' },
  { keywords: ['research', 'lab'], icon: 'science' },
  // work & money
  { keywords: ['salary', 'paycheck', 'wage', 'payroll'], icon: 'work' },
  { keywords: ['save', 'savings', 'emergency fund'], icon: 'savings' },
  { keywords: ['freelance', 'contract', 'gig'], icon: 'business-center' },
  { keywords: ['invest', 'stock', 'dividend', 'portfolio'], icon: 'trending-up' },
  { keywords: ['interest', 'insight'], icon: 'insights' },
  { keywords: ['loan', 'debt', 'quote'], icon: 'request-quote' },
  { keywords: ['exchange', 'currency', 'crypto'], icon: 'currency-exchange' },
  { keywords: ['refund', 'discount', 'cashback'], icon: 'money-off' },
  { keywords: ['sale', 'sold', 'business income'], icon: 'point-of-sale' },
  { keywords: ['rental income', 'real estate', 'property'], icon: 'real-estate-agent' },
  { keywords: ['bank', 'fee', 'account'], icon: 'account-balance' },
  { keywords: ['credit card', 'card'], icon: 'credit-card' },
  { keywords: ['bill', 'receipt', 'invoice'], icon: 'receipt-long' },
  { keywords: ['tax', 'irs'], icon: 'request-quote' },
  { keywords: ['budget', 'money', 'finance', 'wallet'], icon: 'account-balance-wallet' },
  { keywords: ['store', 'shop', 'business'], icon: 'storefront' },
  // travel
  { keywords: ['luggage', 'baggage'], icon: 'luggage' },
  { keywords: ['visa', 'passport'], icon: 'card-travel' },
  { keywords: ['beach', 'vacation', 'holiday'], icon: 'beach-access' },
  { keywords: ['hotel', 'airbnb', 'lodging', 'stay'], icon: 'hotel' },
  { keywords: ['navigate', 'directions'], icon: 'map' },
  { keywords: ['trip', 'adventure'], icon: 'explore' },
  { keywords: ['travel', 'tourism'], icon: 'travel-explore' },
  // family & pets
  { keywords: ['pet', 'dog', 'cat', 'vet'], icon: 'pets' },
  { keywords: ['daycare', 'babysit', 'childcare', 'child care'], icon: 'child-care' },
  { keywords: ['family'], icon: 'family-restroom' },
  { keywords: ['baby', 'stroller'], icon: 'stroller' },
  { keywords: ['toy', 'kid'], icon: 'toys' },
  // gifts & giving
  { keywords: ['gift', 'present'], icon: 'card-giftcard' },
  { keywords: ['donat', 'charity', 'volunteer'], icon: 'volunteer-activism' },
  { keywords: ['church', 'tithe', 'religious'], icon: 'church' },
  { keywords: ['love', 'wedding', 'valentine'], icon: 'favorite' },
  // misc
  { keywords: ['subscription', 'recurring', 'membership fee'], icon: 'autorenew' },
  { keywords: ['insurance', 'protect'], icon: 'security' },
  { keywords: ['warranty', 'shield'], icon: 'shield' },
  { keywords: ['repair', 'fix', 'diy'], icon: 'handyman' },
  { keywords: ['tool', 'build', 'construction'], icon: 'build' },
  { keywords: ['clean', 'housekeep', 'maid'], icon: 'cleaning-services' },
  { keywords: ['laundry', 'dry clean'], icon: 'local-laundry-service' },
];

// Keywords only count when they start at a word boundary — plain `includes`
// would match unrelated substrings (e.g. "brunch" matching a "run" rule).
function matchesKeyword(name: string, keyword: string): boolean {
  const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(^|[^a-z])${escaped}`).test(name);
}

export function suggestCategoryIcon(name: string): (typeof CATEGORY_ICONS)[number] {
  const lower = name.trim().toLowerCase();
  if (!lower) return DEFAULT_CATEGORY_ICON;
  for (const rule of RULES) {
    if (rule.keywords.some((kw) => matchesKeyword(lower, kw))) {
      return rule.icon;
    }
  }
  return DEFAULT_CATEGORY_ICON;
}
