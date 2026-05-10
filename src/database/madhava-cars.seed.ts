import * as bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import { businesses, businessSettings, categories, productFeatures, products, users } from "./schema";

const BUSINESS_PHONE_NUMBER = "9398776311";
const BUSINESS_NAME = "Madhava Auto Deals";
const BUSINESS_SLUG = "madhava-auto-deals";
const BUSINESS_OWNER_EMAIL = "owner@madhava-auto-deals.example.com";
const BUSINESS_OWNER_PASSWORD = "Owner@9398776311";
const BUSINESS_OWNER_NAME = "Madhava Auto Owner";
const CAR_CATEGORY_SLUG = "used-cars";

type SeedCar = {
  name: string;
  slug: string;
  price: string;
  description: string;
  brand: string;
  model: string;
  variant: string;
  year: number;
  mileageKm: number;
  fuelType: "petrol" | "diesel" | "electric" | "hybrid" | "cng";
  transmission: "manual" | "automatic";
  color: string;
  bodyType: string;
  ownership: string;
  insurance: string;
  tags: string[];
  features: Array<{ name: string; value: string }>;
};

const cars: SeedCar[] = [
  {
    name: "Maruti Suzuki Swift ZXI Plus",
    slug: "maruti-suzuki-swift-zxi-plus",
    price: "725000.00",
    description: "2022 Maruti Suzuki Swift ZXI Plus petrol hatchback with touchscreen, reverse camera, and clean service history.",
    brand: "Maruti Suzuki",
    model: "Swift",
    variant: "ZXI Plus",
    year: 2022,
    mileageKm: 26000,
    fuelType: "petrol",
    transmission: "manual",
    color: "Pearl White",
    bodyType: "Hatchback",
    ownership: "First owner",
    insurance: "Comprehensive insurance valid",
    tags: ["maruti", "swift", "petrol", "hatchback", "zxi plus", "city car"],
    features: [
      { name: "Infotainment", value: "7-inch SmartPlay touchscreen with Android Auto and Apple CarPlay" },
      { name: "Safety", value: "Dual airbags, ABS with EBD, rear parking camera" },
      { name: "Comfort", value: "Automatic climate control and height-adjustable driver seat" },
      { name: "Wheels", value: "Factory alloy wheels with good tyre life" },
      { name: "Service", value: "Authorized service records available" },
    ],
  },
  {
    name: "Hyundai Creta SX O Diesel",
    slug: "hyundai-creta-sx-o-diesel",
    price: "1475000.00",
    description: "2021 Hyundai Creta SX O diesel SUV with panoramic sunroof, ventilated seats, Bose audio, and verified documents.",
    brand: "Hyundai",
    model: "Creta",
    variant: "SX O Diesel",
    year: 2021,
    mileageKm: 39000,
    fuelType: "diesel",
    transmission: "automatic",
    color: "Phantom Black",
    bodyType: "SUV",
    ownership: "First owner",
    insurance: "Insurance valid till next renewal cycle",
    tags: ["hyundai", "creta", "diesel", "suv", "sunroof", "automatic"],
    features: [
      { name: "Sunroof", value: "Panoramic sunroof with electric shade" },
      { name: "Seats", value: "Ventilated front seats with leatherette upholstery" },
      { name: "Audio", value: "Bose premium sound system" },
      { name: "Safety", value: "Six airbags, ESC, hill assist, rear camera" },
      { name: "Convenience", value: "Connected car tech and wireless phone charging" },
    ],
  },
  {
    name: "Honda City VX CVT",
    slug: "honda-city-vx-cvt",
    price: "1140000.00",
    description: "2020 Honda City VX CVT petrol sedan with smooth automatic gearbox, cruise control, and premium cabin condition.",
    brand: "Honda",
    model: "City",
    variant: "VX CVT",
    year: 2020,
    mileageKm: 41000,
    fuelType: "petrol",
    transmission: "automatic",
    color: "Lunar Silver",
    bodyType: "Sedan",
    ownership: "First owner",
    insurance: "Comprehensive insurance active",
    tags: ["honda", "city", "sedan", "automatic", "cvt", "petrol"],
    features: [
      { name: "Transmission", value: "Smooth CVT automatic with paddle shifters" },
      { name: "Comfort", value: "Cruise control, rear AC vents, spacious rear seat" },
      { name: "Lighting", value: "LED headlamps and LED tail lamps" },
      { name: "Safety", value: "Four airbags, vehicle stability assist, rear camera" },
      { name: "Interior", value: "Premium beige cabin with clean upholstery" },
    ],
  },
  {
    name: "Tata Nexon EV Max XZ Plus",
    slug: "tata-nexon-ev-max-xz-plus",
    price: "1385000.00",
    description: "2022 Tata Nexon EV Max XZ Plus electric SUV with fast charging, strong battery health, and connected features.",
    brand: "Tata",
    model: "Nexon EV Max",
    variant: "XZ Plus",
    year: 2022,
    mileageKm: 23000,
    fuelType: "electric",
    transmission: "automatic",
    color: "Intensi Teal",
    bodyType: "Electric SUV",
    ownership: "First owner",
    insurance: "Zero-dep insurance active",
    tags: ["tata", "nexon ev", "electric", "automatic", "suv", "fast charging"],
    features: [
      { name: "Battery", value: "40.5 kWh battery pack with checked battery health" },
      { name: "Charging", value: "Fast charging support and home charger included" },
      { name: "Range", value: "Practical city range suitable for daily driving" },
      { name: "Safety", value: "Dual airbags, ABS, ESP, rear camera" },
      { name: "Features", value: "Sunroof, cruise control, connected car app" },
    ],
  },
  {
    name: "Kia Seltos HTX IVT",
    slug: "kia-seltos-htx-ivt",
    price: "1395000.00",
    description: "2021 Kia Seltos HTX IVT petrol automatic SUV with premium infotainment, sunroof, and fresh tyres.",
    brand: "Kia",
    model: "Seltos",
    variant: "HTX IVT",
    year: 2021,
    mileageKm: 33000,
    fuelType: "petrol",
    transmission: "automatic",
    color: "Glacier White",
    bodyType: "SUV",
    ownership: "First owner",
    insurance: "Insurance valid",
    tags: ["kia", "seltos", "automatic", "petrol", "suv", "ivt"],
    features: [
      { name: "Infotainment", value: "10.25-inch touchscreen with navigation" },
      { name: "Sunroof", value: "Electric sunroof" },
      { name: "Comfort", value: "Ventilated seats and automatic climate control" },
      { name: "Safety", value: "Six airbags, ESC, rear camera, tyre pressure monitor" },
      { name: "Exterior", value: "LED headlamps and alloy wheels" },
    ],
  },
  {
    name: "Mahindra XUV700 AX7 Diesel AT",
    slug: "mahindra-xuv700-ax7-diesel-at",
    price: "2450000.00",
    description: "2022 Mahindra XUV700 AX7 diesel automatic with ADAS, panoramic sunroof, and 7-seat family practicality.",
    brand: "Mahindra",
    model: "XUV700",
    variant: "AX7 Diesel AT",
    year: 2022,
    mileageKm: 18000,
    fuelType: "diesel",
    transmission: "automatic",
    color: "Midnight Black",
    bodyType: "7-seater SUV",
    ownership: "First owner",
    insurance: "Comprehensive insurance active",
    tags: ["mahindra", "xuv700", "diesel", "automatic", "adas", "7 seater"],
    features: [
      { name: "ADAS", value: "Adaptive cruise assist, lane keep assist, emergency braking" },
      { name: "Sunroof", value: "Skyroof panoramic sunroof" },
      { name: "Display", value: "Twin digital screens with connected features" },
      { name: "Seating", value: "7-seat layout with flexible third row" },
      { name: "Safety", value: "Seven airbags, ESP, 360-degree camera" },
    ],
  },
  {
    name: "Toyota Innova Crysta ZX",
    slug: "toyota-innova-crysta-zx",
    price: "2150000.00",
    description: "2019 Toyota Innova Crysta ZX diesel 7-seater with captain seats, reliable service history, and family comfort.",
    brand: "Toyota",
    model: "Innova Crysta",
    variant: "ZX",
    year: 2019,
    mileageKm: 64000,
    fuelType: "diesel",
    transmission: "manual",
    color: "Super White",
    bodyType: "MPV",
    ownership: "Second owner",
    insurance: "Insurance valid",
    tags: ["toyota", "innova", "crysta", "diesel", "7 seater", "family"],
    features: [
      { name: "Seating", value: "Captain seats in second row and 7-seat layout" },
      { name: "Comfort", value: "Automatic climate control and rear AC" },
      { name: "Reliability", value: "Toyota service history available" },
      { name: "Safety", value: "Airbags, ABS, vehicle stability control" },
      { name: "Utility", value: "Spacious boot with foldable third row" },
    ],
  },
  {
    name: "MG Hector Sharp Hybrid",
    slug: "mg-hector-sharp-hybrid",
    price: "1575000.00",
    description: "2020 MG Hector Sharp Hybrid petrol SUV with panoramic sunroof, large touchscreen, and premium cabin space.",
    brand: "MG",
    model: "Hector",
    variant: "Sharp Hybrid",
    year: 2020,
    mileageKm: 36000,
    fuelType: "hybrid",
    transmission: "manual",
    color: "Starry Black",
    bodyType: "SUV",
    ownership: "First owner",
    insurance: "Insurance valid",
    tags: ["mg", "hector", "hybrid", "suv", "sunroof", "petrol"],
    features: [
      { name: "Infotainment", value: "10.4-inch vertical touchscreen with connected car features" },
      { name: "Sunroof", value: "Panoramic sunroof" },
      { name: "Camera", value: "360-degree camera" },
      { name: "Cabin", value: "Large rear seat space and premium upholstery" },
      { name: "Safety", value: "Six airbags, ESP, traction control" },
    ],
  },
  {
    name: "Renault Kiger RXZ Turbo CVT",
    slug: "renault-kiger-rxz-turbo-cvt",
    price: "895000.00",
    description: "2022 Renault Kiger RXZ Turbo CVT compact SUV with wireless smartphone connectivity and sporty turbo performance.",
    brand: "Renault",
    model: "Kiger",
    variant: "RXZ Turbo CVT",
    year: 2022,
    mileageKm: 21000,
    fuelType: "petrol",
    transmission: "automatic",
    color: "Caspian Blue",
    bodyType: "Compact SUV",
    ownership: "First owner",
    insurance: "Comprehensive insurance valid",
    tags: ["renault", "kiger", "turbo", "automatic", "compact suv", "petrol"],
    features: [
      { name: "Engine", value: "1.0 turbo petrol engine" },
      { name: "Transmission", value: "CVT automatic gearbox" },
      { name: "Infotainment", value: "Wireless Android Auto and Apple CarPlay" },
      { name: "Drive Modes", value: "Eco, Normal, and Sport modes" },
      { name: "Storage", value: "Practical cabin storage and boot space" },
    ],
  },
  {
    name: "Volkswagen Taigun GT DSG",
    slug: "volkswagen-taigun-gt-dsg",
    price: "1565000.00",
    description: "2022 Volkswagen Taigun GT DSG petrol SUV with 1.5 TSI performance, DSG automatic, and solid build quality.",
    brand: "Volkswagen",
    model: "Taigun",
    variant: "GT DSG",
    year: 2022,
    mileageKm: 24000,
    fuelType: "petrol",
    transmission: "automatic",
    color: "Wild Cherry Red",
    bodyType: "SUV",
    ownership: "First owner",
    insurance: "Insurance active",
    tags: ["volkswagen", "taigun", "gt", "dsg", "automatic", "suv"],
    features: [
      { name: "Engine", value: "1.5 TSI turbo petrol with active cylinder tech" },
      { name: "Transmission", value: "7-speed DSG automatic" },
      { name: "Safety", value: "Six airbags, ESC, hill hold, tyre pressure monitor" },
      { name: "Interior", value: "Digital cockpit and leatherette seats" },
      { name: "Convenience", value: "Wireless charging and connected car features" },
    ],
  },
  {
    name: "Skoda Slavia Style TSI",
    slug: "skoda-slavia-style-tsi",
    price: "1490000.00",
    description: "2023 Skoda Slavia Style TSI sedan with turbo petrol engine, sunroof, and premium European ride quality.",
    brand: "Skoda",
    model: "Slavia",
    variant: "Style TSI",
    year: 2023,
    mileageKm: 12000,
    fuelType: "petrol",
    transmission: "manual",
    color: "Carbon Steel",
    bodyType: "Sedan",
    ownership: "First owner",
    insurance: "Zero-dep insurance active",
    tags: ["skoda", "slavia", "tsi", "sedan", "sunroof", "petrol"],
    features: [
      { name: "Engine", value: "1.0 TSI turbo petrol engine" },
      { name: "Sunroof", value: "Electric sunroof" },
      { name: "Safety", value: "Six airbags, ESC, multi-collision braking" },
      { name: "Comfort", value: "Ventilated front seats and rear AC vents" },
      { name: "Boot", value: "Large sedan boot for family travel" },
    ],
  },
  {
    name: "Maruti Suzuki Baleno Alpha",
    slug: "maruti-suzuki-baleno-alpha",
    price: "790000.00",
    description: "2021 Maruti Suzuki Baleno Alpha petrol hatchback with projector headlamps, touchscreen, and excellent efficiency.",
    brand: "Maruti Suzuki",
    model: "Baleno",
    variant: "Alpha",
    year: 2021,
    mileageKm: 29000,
    fuelType: "petrol",
    transmission: "manual",
    color: "Nexa Blue",
    bodyType: "Premium hatchback",
    ownership: "First owner",
    insurance: "Insurance valid",
    tags: ["maruti", "baleno", "alpha", "petrol", "hatchback", "nexa"],
    features: [
      { name: "Lighting", value: "Projector headlamps with LED DRLs" },
      { name: "Infotainment", value: "SmartPlay touchscreen with phone connectivity" },
      { name: "Efficiency", value: "Efficient petrol engine for city use" },
      { name: "Safety", value: "Dual airbags, ABS with EBD, rear camera" },
      { name: "Interior", value: "Spacious cabin with premium hatchback comfort" },
    ],
  },
  {
    name: "Hyundai Verna SX Turbo",
    slug: "hyundai-verna-sx-turbo",
    price: "1435000.00",
    description: "2023 Hyundai Verna SX Turbo petrol sedan with strong turbo performance, connected features, and modern cabin.",
    brand: "Hyundai",
    model: "Verna",
    variant: "SX Turbo",
    year: 2023,
    mileageKm: 11000,
    fuelType: "petrol",
    transmission: "manual",
    color: "Fiery Red",
    bodyType: "Sedan",
    ownership: "First owner",
    insurance: "Comprehensive insurance active",
    tags: ["hyundai", "verna", "turbo", "sedan", "petrol", "sx"],
    features: [
      { name: "Engine", value: "1.5 turbo petrol engine" },
      { name: "Display", value: "Digital cluster and large infotainment display" },
      { name: "Comfort", value: "Automatic climate control and rear AC vents" },
      { name: "Safety", value: "Six airbags, ESC, hill assist" },
      { name: "Technology", value: "Connected car features and wireless charger" },
    ],
  },
  {
    name: "Tata Harrier XZA Plus",
    slug: "tata-harrier-xza-plus",
    price: "1780000.00",
    description: "2021 Tata Harrier XZA Plus diesel automatic SUV with panoramic sunroof, terrain modes, and strong road presence.",
    brand: "Tata",
    model: "Harrier",
    variant: "XZA Plus",
    year: 2021,
    mileageKm: 42000,
    fuelType: "diesel",
    transmission: "automatic",
    color: "Orcus White",
    bodyType: "SUV",
    ownership: "First owner",
    insurance: "Insurance valid",
    tags: ["tata", "harrier", "diesel", "automatic", "suv", "sunroof"],
    features: [
      { name: "Sunroof", value: "Panoramic sunroof" },
      { name: "Transmission", value: "Diesel automatic with terrain response modes" },
      { name: "Audio", value: "JBL tuned audio system" },
      { name: "Safety", value: "Six airbags, ESP, hill descent control" },
      { name: "Comfort", value: "Powered driver seat and leatherette upholstery" },
    ],
  },
  {
    name: "Toyota Fortuner 4x2 AT",
    slug: "toyota-fortuner-4x2-at",
    price: "3150000.00",
    description: "2018 Toyota Fortuner 4x2 diesel automatic SUV with strong service history, commanding drive, and premium cabin.",
    brand: "Toyota",
    model: "Fortuner",
    variant: "4x2 AT",
    year: 2018,
    mileageKm: 72000,
    fuelType: "diesel",
    transmission: "automatic",
    color: "Attitude Black",
    bodyType: "SUV",
    ownership: "Second owner",
    insurance: "Insurance active",
    tags: ["toyota", "fortuner", "diesel", "automatic", "suv", "premium"],
    features: [
      { name: "Engine", value: "2.8 diesel engine with automatic gearbox" },
      { name: "Seating", value: "7-seat layout with leather upholstery" },
      { name: "Safety", value: "Airbags, ABS, stability control, rear camera" },
      { name: "Reliability", value: "Service history and verified documents" },
      { name: "Presence", value: "High ground clearance and strong highway comfort" },
    ],
  },
  {
    name: "Honda Amaze VX Diesel",
    slug: "honda-amaze-vx-diesel",
    price: "810000.00",
    description: "2020 Honda Amaze VX diesel compact sedan with good mileage, practical boot, and comfortable daily driving.",
    brand: "Honda",
    model: "Amaze",
    variant: "VX Diesel",
    year: 2020,
    mileageKm: 38000,
    fuelType: "diesel",
    transmission: "manual",
    color: "Modern Steel",
    bodyType: "Compact sedan",
    ownership: "First owner",
    insurance: "Insurance valid",
    tags: ["honda", "amaze", "diesel", "sedan", "manual", "mileage"],
    features: [
      { name: "Efficiency", value: "Diesel engine tuned for high mileage" },
      { name: "Boot", value: "Spacious boot for family use" },
      { name: "Infotainment", value: "Touchscreen with Android Auto and Apple CarPlay" },
      { name: "Safety", value: "Dual airbags, ABS with EBD, rear camera" },
      { name: "Comfort", value: "Automatic climate control and premium seat fabric" },
    ],
  },
  {
    name: "Nissan Magnite XV Premium",
    slug: "nissan-magnite-xv-premium",
    price: "785000.00",
    description: "2022 Nissan Magnite XV Premium petrol compact SUV with 360 camera, wireless connectivity, and high ground clearance.",
    brand: "Nissan",
    model: "Magnite",
    variant: "XV Premium",
    year: 2022,
    mileageKm: 19000,
    fuelType: "petrol",
    transmission: "manual",
    color: "Onyx Black",
    bodyType: "Compact SUV",
    ownership: "First owner",
    insurance: "Comprehensive insurance valid",
    tags: ["nissan", "magnite", "petrol", "compact suv", "xv premium", "manual"],
    features: [
      { name: "Camera", value: "Around-view monitor with 360-degree camera" },
      { name: "Connectivity", value: "Wireless Android Auto and Apple CarPlay" },
      { name: "Convenience", value: "Push-button start and smart key" },
      { name: "Safety", value: "Dual airbags, ABS, traction control" },
      { name: "Design", value: "High ground clearance and SUV styling" },
    ],
  },
  {
    name: "Mahindra Thar LX 4x4 Diesel",
    slug: "mahindra-thar-lx-4x4-diesel",
    price: "1480000.00",
    description: "2021 Mahindra Thar LX 4x4 diesel manual with hard top, off-road hardware, and lifestyle SUV appeal.",
    brand: "Mahindra",
    model: "Thar",
    variant: "LX 4x4 Diesel",
    year: 2021,
    mileageKm: 27000,
    fuelType: "diesel",
    transmission: "manual",
    color: "Napoli Black",
    bodyType: "Lifestyle SUV",
    ownership: "First owner",
    insurance: "Insurance active",
    tags: ["mahindra", "thar", "diesel", "4x4", "off road", "suv"],
    features: [
      { name: "Drivetrain", value: "4x4 system with low range transfer case" },
      { name: "Roof", value: "Factory hard top" },
      { name: "Safety", value: "Dual airbags, roll cage, ESP" },
      { name: "Infotainment", value: "Touchscreen infotainment with adventure stats" },
      { name: "Use Case", value: "Suitable for weekend drives and off-road trails" },
    ],
  },
  {
    name: "BMW X1 sDrive20d xLine",
    slug: "bmw-x1-sdrive20d-xline",
    price: "2590000.00",
    description: "2018 BMW X1 sDrive20d xLine diesel automatic luxury SUV with panoramic sunroof and premium German cabin.",
    brand: "BMW",
    model: "X1",
    variant: "sDrive20d xLine",
    year: 2018,
    mileageKm: 54000,
    fuelType: "diesel",
    transmission: "automatic",
    color: "Mineral White",
    bodyType: "Luxury SUV",
    ownership: "Second owner",
    insurance: "Insurance valid",
    tags: ["bmw", "x1", "diesel", "automatic", "luxury", "suv"],
    features: [
      { name: "Luxury", value: "Premium leatherette interior and panoramic sunroof" },
      { name: "Drive", value: "Diesel automatic with BMW drive modes" },
      { name: "Safety", value: "Multiple airbags, stability control, parking sensors" },
      { name: "Infotainment", value: "BMW iDrive infotainment system" },
      { name: "Documents", value: "Verified RC, insurance, and service records" },
    ],
  },
  {
    name: "Mercedes-Benz C 220d Avantgarde",
    slug: "mercedes-benz-c-220d-avantgarde",
    price: "2850000.00",
    description: "2017 Mercedes-Benz C 220d Avantgarde diesel automatic luxury sedan with premium comfort and verified service history.",
    brand: "Mercedes-Benz",
    model: "C-Class",
    variant: "C 220d Avantgarde",
    year: 2017,
    mileageKm: 61000,
    fuelType: "diesel",
    transmission: "automatic",
    color: "Obsidian Black",
    bodyType: "Luxury sedan",
    ownership: "Second owner",
    insurance: "Insurance active",
    tags: ["mercedes", "c class", "c220d", "diesel", "automatic", "luxury sedan"],
    features: [
      { name: "Comfort", value: "Premium cabin with powered front seats" },
      { name: "Transmission", value: "Smooth diesel automatic drivetrain" },
      { name: "Safety", value: "Multiple airbags, ESP, attention assist" },
      { name: "Infotainment", value: "Mercedes COMAND infotainment system" },
      { name: "Service", value: "Verified service history and document check" },
    ],
  },
];

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required to run the Madhava Auto Deals seed");
  }

  const client = postgres(databaseUrl, { prepare: false });
  const db = drizzle(client);

  try {
    const now = new Date();
    const passwordHash = await bcrypt.hash(BUSINESS_OWNER_PASSWORD, 10);
    const sharedVirtualNumber =
      process.env.CENTRAL_AGENT_NUMBER || process.env.EXOTEL_VIRTUAL_NUMBER || process.env.EXOTEL_CALLER_ID || null;

    const [owner] = await db
      .insert(users)
      .values({
        name: BUSINESS_OWNER_NAME,
        email: BUSINESS_OWNER_EMAIL,
        passwordHash,
        mobile: BUSINESS_PHONE_NUMBER,
        role: "owner",
        status: "active",
        isActive: true,
        businessId: null,
        createdAt: now,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: users.email,
        set: {
          name: BUSINESS_OWNER_NAME,
          passwordHash,
          mobile: BUSINESS_PHONE_NUMBER,
          role: "owner",
          status: "active",
          isActive: true,
          updatedAt: now,
        },
      })
      .returning();

    const businessValues = {
      ownerUserId: owner.id,
      businessName: BUSINESS_NAME,
      slug: BUSINESS_SLUG,
      serviceType: "car_dealer" as const,
      businessType: "used_car_dealer",
      contactNumber: BUSINESS_PHONE_NUMBER,
      primaryEmail: BUSINESS_OWNER_EMAIL,
      primaryMobile: sharedVirtualNumber,
      forwardingNumber: sharedVirtualNumber,
      aiAgentPhoneNumber: sharedVirtualNumber,
      city: "Hyderabad",
      state: "Telangana",
      address: "Madhava Auto Deals, Hyderabad, Telangana",
      googleMapLink: "https://maps.google.com/?q=Madhava+Auto+Deals+Hyderabad",
      planCode: "starter" as const,
      status: "active" as const,
      voiceAgentEnabled: true,
      callsIncluded: 1000,
      metadata: {
        description:
          "Used car dealership in Hyderabad with verified cars, test drives, exchange support, finance assistance, and callback booking.",
        welcomeMessage: `Welcome to ${BUSINESS_NAME}. How may I help you today?`,
        planCode: "starter",
        seed: "madhava-cars",
      },
      updatedAt: now,
    };

    const [business] = await db
      .insert(businesses)
      .values({
        ...businessValues,
        createdAt: now,
      })
      .onConflictDoUpdate({
        target: businesses.contactNumber,
        set: businessValues,
      })
      .returning();

    await db.update(users).set({ businessId: business.id, updatedAt: now }).where(eq(users.id, owner.id));

    await db
      .update(businesses)
      .set({ ownerUserId: owner.id, updatedAt: now })
      .where(eq(businesses.id, business.id));

    await db
      .insert(businessSettings)
      .values({
        businessId: business.id,
        openingTime: "09:00:00",
        closingTime: "20:00:00",
        workingDays: ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"],
        bookingEnabled: true,
        autoAnswerEnabled: true,
        aiInstructions:
          "Answer as a helpful used-car dealership assistant. Use only current inventory, collect name and 10-digit mobile for bookings, and offer callback or test drive when requested.",
        welcomeMessage: `Welcome to ${BUSINESS_NAME}. How may I help you today?`,
        fallbackMessage:
          "Please share your name, phone number, and preferred car. Our sales team will call you back shortly.",
        collectCustomerName: true,
        collectCustomerPhone: true,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: businessSettings.businessId,
        set: {
          openingTime: "09:00:00",
          closingTime: "20:00:00",
          workingDays: ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"],
          bookingEnabled: true,
          autoAnswerEnabled: true,
          aiInstructions:
            "Answer as a helpful used-car dealership assistant. Use only current inventory, collect name and 10-digit mobile for bookings, and offer callback or test drive when requested.",
          welcomeMessage: `Welcome to ${BUSINESS_NAME}. How may I help you today?`,
          fallbackMessage:
            "Please share your name, phone number, and preferred car. Our sales team will call you back shortly.",
          collectCustomerName: true,
          collectCustomerPhone: true,
          updatedAt: now,
        },
      });

    const [carCategory] = await db
      .insert(categories)
      .values({
        businessId: business.id,
        name: "Used Cars",
        slug: CAR_CATEGORY_SLUG,
        itemType: "product",
        sortOrder: 1,
        isActive: true,
        createdAt: now,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: [categories.businessId, categories.slug],
        set: {
          name: "Used Cars",
          itemType: "product",
          sortOrder: 1,
          isActive: true,
          updatedAt: now,
        },
      })
      .returning();

    for (const [index, car] of cars.entries()) {
      const specifications = {
        bodyType: car.bodyType,
        ownership: car.ownership,
        insurance: car.insurance,
        testDriveAvailable: true,
        financeAvailable: true,
        exchangeAccepted: true,
        rcVerified: true,
        serviceHistoryAvailable: true,
        highlights: car.features.map((feature) => `${feature.name}: ${feature.value}`),
      };

      const [product] = await db
        .insert(products)
        .values({
          businessId: business.id,
          categoryId: carCategory.id,
          name: car.name,
          slug: car.slug,
          description: car.description,
          category: "car",
          itemType: "product",
          condition: "used",
          status: "available",
          sku: `MAD-${String(index + 1).padStart(3, "0")}`,
          brand: car.brand,
          model: car.model,
          variant: car.variant,
          price: car.price,
          currency: "INR",
          stockQuantity: 1,
          manufactureYear: car.year,
          registrationYear: car.year,
          mileageKm: car.mileageKm,
          fuelType: car.fuelType,
          transmission: car.transmission,
          color: car.color,
          locationCity: "Hyderabad",
          locationState: "Telangana",
          conditionNotes: "Verified documents, inspected condition, test drive available by appointment.",
          searchTags: car.tags,
          specifications,
          isNegotiable: true,
          isFeatured: index < 6,
          createdAt: now,
          updatedAt: now,
        })
        .onConflictDoUpdate({
          target: [products.businessId, products.slug],
          set: {
            categoryId: carCategory.id,
            name: car.name,
            description: car.description,
            category: "car",
            itemType: "product",
            condition: "used",
            status: "available",
            sku: `MAD-${String(index + 1).padStart(3, "0")}`,
            brand: car.brand,
            model: car.model,
            variant: car.variant,
            price: car.price,
            currency: "INR",
            stockQuantity: 1,
            manufactureYear: car.year,
            registrationYear: car.year,
            mileageKm: car.mileageKm,
            fuelType: car.fuelType,
            transmission: car.transmission,
            color: car.color,
            locationCity: "Hyderabad",
            locationState: "Telangana",
            conditionNotes: "Verified documents, inspected condition, test drive available by appointment.",
            searchTags: car.tags,
            specifications,
            isNegotiable: true,
            isFeatured: index < 6,
            updatedAt: now,
          },
        })
        .returning();

      await db.delete(productFeatures).where(eq(productFeatures.productId, product.id));

      await db.insert(productFeatures).values(
        car.features.map((feature, featureIndex) => ({
          productId: product.id,
          featureName: feature.name,
          featureValue: feature.value,
          sortOrder: featureIndex + 1,
          createdAt: now,
          updatedAt: now,
        })),
      );
    }

    const seededProducts = await db.select({ id: products.id }).from(products).where(eq(products.businessId, business.id));

    console.log(`Seeded ${business.businessName} with business number ${business.contactNumber}`);
    console.log(`Business ID: ${business.id}`);
    console.log(`Owner user ID: ${owner.id}`);
    console.log(`Products for this business: ${seededProducts.length}`);
    console.log("Login credentials:");
    console.log(`  Email: ${BUSINESS_OWNER_EMAIL}`);
    console.log(`  Password: ${BUSINESS_OWNER_PASSWORD}`);
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
