// Ported verbatim from personal-expense-tracker/shared/schema.ts
// Pure keyword-based categoriser. Priority order matters for ambiguous
// items (e.g. "fruit biskut" → biscuits, not fruits).

export const GROCERY_PLATFORMS = [
  "zepto",
  "swiggy_instamart",
  "other",
] as const;

export type GroceryPlatform = (typeof GROCERY_PLATFORMS)[number];

export const GROCERY_CATEGORIES = [
  "dairy",
  "fruits",
  "vegetables",
  "bread_bakery",
  "biscuits_cookies",
  "snacks",
  "beverages",
  "staples",
  "meat_eggs",
  "personal_care",
  "cleaning_household",
  "other",
] as const;

export type GroceryCategory = (typeof GROCERY_CATEGORIES)[number];

export const GROCERY_CATEGORY_LABELS: Record<GroceryCategory, string> = {
  dairy: "Dairy",
  fruits: "Fruits",
  vegetables: "Vegetables",
  bread_bakery: "Bread & Bakery",
  biscuits_cookies: "Biscuits & Cookies",
  snacks: "Snacks",
  beverages: "Beverages",
  staples: "Staples & Grains",
  meat_eggs: "Meat & Eggs",
  personal_care: "Personal Care",
  cleaning_household: "Cleaning & Household",
  other: "Other",
};

export const GROCERY_CATEGORY_KEYWORDS: Record<GroceryCategory, string[]> = {
  dairy: [
    "milk", "curd", "yogurt", "yoghurt", "paneer", "cheese", "butter", "ghee",
    "chass", "chaas", "buttermilk", "lassi", "dahi", "whey", "milky mist", "amul",
    "desi farms", "mother dairy", "nestle", "verka", "nandini", "fresh cream",
  ],
  fruits: [
    "apple", "banana", "mango", "orange", "grape", "guava", "peru", "papaya", "pomegranate",
    "watermelon", "melon", "kiwi", "pineapple", "strawberry", "blueberry", "cherry",
    "pear", "plum", "peach", "lemon", "lime", "coconut", "fig", "dates", "chikoo",
    "sapota", "custard apple", "sitaphal", "dragon fruit", "robusta",
  ],
  vegetables: [
    "tomato", "potato", "onion", "carrot", "capsicum", "cucumber", "kakadi", "spinach",
    "palak", "cabbage", "cauliflower", "broccoli", "beans", "peas", "corn", "beetroot",
    "radish", "moola", "drumstick", "shevga", "lady finger", "bhindi", "brinjal",
    "eggplant", "mushroom", "ginger", "garlic", "coriander", "mint", "curry leaves",
    "green chilli", "methi", "dill", "bottle gourd", "ridge gourd", "bitter gourd",
    "pumpkin", "sweet potato", "yam", "vegetable", "veggie", "sabzi",
  ],
  bread_bakery: [
    "bread", "bun", "pav", "roti", "naan", "tortilla", "croissant", "muffin", "cake",
    "pastry", "donut", "bagel", "baguette", "whole wheat bread", "brown bread",
    "multigrain bread", "sourdough", "brioche", "health factory", "protein chef",
  ],
  biscuits_cookies: [
    "biscuit", "biskut", "cookie", "cookies", "britannia", "parle", "unibic", "oreo",
    "good day", "marie gold", "hide seek", "bourbon", "jim jam", "cream biscuit",
    "digestive", "cracker", "rusk", "toast", "wafer", "mcvities", "sunfeast",
  ],
  snacks: [
    "chips", "namkeen", "mixture", "bhujia", "kurkure", "lays", "bingo", "too yumm",
    "veggie stix", "pringles", "doritos", "nachos", "popcorn", "makhana", "fox nut",
    "haldiram", "bikano", "balaji", "snack", "sev", "chivda", "farsan", "trail mix",
    "granola bar", "protein bar", "energy bar", "dry fruits", "nuts", "almonds",
    "cashew", "peanut", "walnut", "pistachio",
  ],
  beverages: [
    "juice", "drink", "tea", "coffee", "cola", "soda", "water", "oat drink", "alt co",
    "smoothie", "shake", "kombucha", "energy drink", "red bull", "sting", "tang",
    "real fruit", "tropicana", "paper boat", "aam panna", "nimbu pani", "tonic",
    "sparkling", "mineral water",
  ],
  staples: [
    "rice", "dal", "lentil", "atta", "flour", "maida", "besan", "rava", "sooji",
    "suji", "oats", "muesli", "cornflakes", "cereal", "pasta", "noodles", "maggi",
    "oil", "salt", "sugar", "jaggery", "honey", "vinegar", "soy sauce", "ketchup",
    "sauce", "pickle", "papad", "spice", "masala", "turmeric", "chilli powder",
    "cumin", "coriander powder", "garam masala", "pulses", "rajma", "chole",
    "chana", "moong", "toor", "urad",
  ],
  meat_eggs: [
    "chicken", "mutton", "fish", "prawn", "shrimp", "egg", "pork", "lamb", "meat",
    "sausage", "bacon", "salami", "ham", "turkey", "seafood", "crab",
  ],
  personal_care: [
    "shampoo", "soap", "toothpaste", "toothbrush", "deodorant", "body wash",
    "face wash", "moisturizer", "sunscreen", "razor", "shaving", "sanitary",
    "pad", "tampon", "tissue", "cotton", "lotion", "cream", "hair oil",
    "conditioner", "perfume", "hand wash", "sanitizer",
  ],
  cleaning_household: [
    "detergent", "surf", "rin", "vim", "harpic", "lizol", "phenyl", "dettol",
    "floor cleaner", "toilet cleaner", "dish wash", "scrubber", "sponge", "broom",
    "mop", "dustbin", "garbage bag", "aluminium foil", "cling wrap", "tissue paper",
    "air freshener", "naphthalene", "insecticide", "mosquito", "good knight",
    "all out", "hit",
  ],
  other: [],
};

// Check specific categories first to avoid false matches.
const GROCERY_CATEGORY_PRIORITY: GroceryCategory[] = [
  "biscuits_cookies", "snacks", "bread_bakery", "beverages",
  "vegetables", "fruits", "dairy", "staples", "meat_eggs",
  "personal_care", "cleaning_household",
];

export function categorizeGroceryItem(name: string): GroceryCategory {
  const n = name.toLowerCase();
  for (const category of GROCERY_CATEGORY_PRIORITY) {
    const keywords = GROCERY_CATEGORY_KEYWORDS[category];
    for (const keyword of keywords) {
      if (n.includes(keyword.toLowerCase())) {
        return category;
      }
    }
  }
  return "other";
}
