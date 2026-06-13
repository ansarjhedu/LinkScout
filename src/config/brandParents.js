/**
 * Known manufacturer parent company lookup for franchise hierarchy.
 */
export const BRAND_PARENT_MAP = {
  Polaris: "Polaris Inc.",
  "Can-Am": "BRP",
  "Sea-Doo": "BRP",
  Spyder: "BRP",
  "Ski-Doo": "BRP",
  KTM: "Pierer Mobility",
  Honda: "Honda",
  Kawasaki: "Kawasaki",
  Suzuki: "Suzuki",
  "Atlas Golf": "Atlas Golf Carts",
  Yamaha: "Yamaha Motor Company",
  "Harley-Davidson": "Harley-Davidson Inc.",
  Indian: "Polaris Inc.",
  BMW: "BMW Group",
  Ducati: "Ducati Motor Holding",
  Triumph: "Triumph Motorcycles",
  Husqvarna: "Pierer Mobility"
};

export const KNOWN_BRANDS = Object.keys(BRAND_PARENT_MAP);

export const BRAND_PRODUCT_HINTS = {
  Polaris: ["ATV", "SxS"],
  "Can-Am": ["ATV", "SxS"],
  Honda: ["Motorcycle", "ATV", "SxS"],
  Kawasaki: ["Motorcycle", "ATV", "SxS"],
  Suzuki: ["Motorcycle", "ATV"],
  "Sea-Doo": ["PWC"],
  Spyder: ["3-Wheel Motorcycle"],
  KTM: ["Motorcycle"],
  "Atlas Golf": ["Golf Cart"]
};
