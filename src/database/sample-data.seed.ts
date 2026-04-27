import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import { businesses, businessSettings, products } from "./schema";

const BUSINESS_NUMBER = "9133603383";
const BUSINESS_SLUG = "buildyourvision-cars";

const GANESH_BUSINESS_NUMBER = "7816087488";
const GANESH_BUSINESS_SLUG = "ganesh-car-rentals";

const sampleCars = [
  {
    name: "Hyundai Creta SX Diesel",
    slug: "hyundai-creta-sx-diesel",
    price: "1425000.00",
    description: "2022 Hyundai Creta SX diesel with sunroof, touchscreen infotainment, rear camera, and service history.",
    brand: "Hyundai",
    model: "Creta",
    variant: "SX Diesel",
    year: 2022,
    mileageKm: 28000,
    fuelType: "diesel" as const,
    transmission: "manual" as const,
    color: "White",
    tags: ["hyundai", "creta", "diesel", "suv", "sunroof"],
  },
  {
    name: "Maruti Suzuki Swift VXI",
    slug: "maruti-suzuki-swift-vxi",
    price: "645000.00",
    description: "2021 Maruti Suzuki Swift VXI petrol, single-owner hatchback with clean interiors and city-ready mileage.",
    brand: "Maruti Suzuki",
    model: "Swift",
    variant: "VXI",
    year: 2021,
    mileageKm: 34000,
    fuelType: "petrol" as const,
    transmission: "manual" as const,
    color: "Red",
    tags: ["maruti", "swift", "petrol", "hatchback", "single owner"],
  },
  {
    name: "Honda City ZX CVT",
    slug: "honda-city-zx-cvt",
    price: "1180000.00",
    description: "2020 Honda City ZX automatic sedan with leather seats, alloy wheels, cruise control, and full insurance.",
    brand: "Honda",
    model: "City",
    variant: "ZX CVT",
    year: 2020,
    mileageKm: 42000,
    fuelType: "petrol" as const,
    transmission: "automatic" as const,
    color: "Silver",
    tags: ["honda", "city", "automatic", "sedan", "cvt"],
  },
  {
    name: "Toyota Innova Crysta GX",
    slug: "toyota-innova-crysta-gx",
    price: "1890000.00",
    description: "2019 Toyota Innova Crysta GX diesel 7-seater with excellent service record and family-ready comfort.",
    brand: "Toyota",
    model: "Innova Crysta",
    variant: "GX 7 Seater",
    year: 2019,
    mileageKm: 62000,
    fuelType: "diesel" as const,
    transmission: "manual" as const,
    color: "Grey",
    tags: ["toyota", "innova", "diesel", "7 seater", "family car"],
  },
  {
    name: "Mahindra XUV700 AX7",
    slug: "mahindra-xuv700-ax7",
    price: "2260000.00",
    description: "2023 Mahindra XUV700 AX7 petrol automatic with panoramic sunroof, ADAS, and premium cabin.",
    brand: "Mahindra",
    model: "XUV700",
    variant: "AX7 Automatic",
    year: 2023,
    mileageKm: 15000,
    fuelType: "petrol" as const,
    transmission: "automatic" as const,
    color: "Midnight Black",
    tags: ["mahindra", "xuv700", "automatic", "suv", "adas"],
  },
  {
    name: "Tata Nexon EV XZ Plus",
    slug: "tata-nexon-ev-xz-plus",
    price: "1295000.00",
    description: "2022 Tata Nexon EV XZ Plus with fast charging support, clean battery health, and compact SUV practicality.",
    brand: "Tata",
    model: "Nexon EV",
    variant: "XZ Plus",
    year: 2022,
    mileageKm: 24000,
    fuelType: "electric" as const,
    transmission: "automatic" as const,
    color: "Teal Blue",
    tags: ["tata", "nexon ev", "electric", "automatic", "suv"],
  },
  {
    name: "Kia Seltos HTX Petrol",
    slug: "kia-seltos-htx-petrol",
    price: "1375000.00",
    description: "2021 Kia Seltos HTX petrol manual with ventilated seats, connected features, and fresh tyres.",
    brand: "Kia",
    model: "Seltos",
    variant: "HTX",
    year: 2021,
    mileageKm: 31000,
    fuelType: "petrol" as const,
    transmission: "manual" as const,
    color: "White",
    tags: ["kia", "seltos", "petrol", "suv", "htx"],
  },
  {
    name: "BMW 320d Luxury Line",
    slug: "bmw-320d-luxury-line",
    price: "3250000.00",
    description: "2018 BMW 320d Luxury Line diesel automatic with premium interiors, strong performance, and verified documents.",
    brand: "BMW",
    model: "3 Series",
    variant: "320d Luxury Line",
    year: 2018,
    mileageKm: 58000,
    fuelType: "diesel" as const,
    transmission: "automatic" as const,
    color: "Black",
    tags: ["bmw", "320d", "luxury", "diesel", "automatic"],
  },
];

const ganeshSampleCars = [
  {
    name: "Maruti Suzuki Swift LXI",
    slug: "maruti-suzuki-swift-lxi",
    price: "450000.00",
    description: "2018 Maruti Suzuki Swift LXI petrol, well maintained hatchback.",
    brand: "Maruti Suzuki",
    model: "Swift",
    variant: "LXI",
    year: 2018,
    mileageKm: 55000,
    fuelType: "petrol" as const,
    transmission: "manual" as const,
    color: "White",
    tags: ["maruti", "swift", "petrol", "hatchback", "manual"],
  },
  {
    name: "Hyundai i20 Magna",
    slug: "hyundai-i20-magna",
    price: "520000.00",
    description: "2019 Hyundai i20 Magna petrol, clean interiors and great mileage.",
    brand: "Hyundai",
    model: "i20",
    variant: "Magna",
    year: 2019,
    mileageKm: 45000,
    fuelType: "petrol" as const,
    transmission: "manual" as const,
    color: "Silver",
    tags: ["hyundai", "i20", "petrol", "hatchback", "manual"],
  },
  {
    name: "Tata Nexon XZ",
    slug: "tata-nexon-xz",
    price: "850000.00",
    description: "2021 Tata Nexon XZ petrol, safe and robust compact SUV.",
    brand: "Tata",
    model: "Nexon",
    variant: "XZ",
    year: 2021,
    mileageKm: 30000,
    fuelType: "petrol" as const,
    transmission: "manual" as const,
    color: "Red",
    tags: ["tata", "nexon", "petrol", "suv", "manual"],
  },
  {
    name: "Mahindra Scorpio S11",
    slug: "mahindra-scorpio-s11",
    price: "1350000.00",
    description: "2020 Mahindra Scorpio S11 diesel, powerful SUV with alloy wheels.",
    brand: "Mahindra",
    model: "Scorpio",
    variant: "S11",
    year: 2020,
    mileageKm: 60000,
    fuelType: "diesel" as const,
    transmission: "manual" as const,
    color: "Black",
    tags: ["mahindra", "scorpio", "diesel", "suv", "manual"],
  },
  {
    name: "Kia Sonet HTK",
    slug: "kia-sonet-htk",
    price: "900000.00",
    description: "2022 Kia Sonet HTK petrol, feature-rich compact SUV.",
    brand: "Kia",
    model: "Sonet",
    variant: "HTK",
    year: 2022,
    mileageKm: 25000,
    fuelType: "petrol" as const,
    transmission: "manual" as const,
    color: "Grey",
    tags: ["kia", "sonet", "petrol", "suv", "manual"],
  },
  {
    name: "Toyota Etios Liva",
    slug: "toyota-etios-liva",
    price: "350000.00",
    description: "2017 Toyota Etios Liva petrol, reliable and spacious hatchback.",
    brand: "Toyota",
    model: "Etios Liva",
    variant: "G",
    year: 2017,
    mileageKm: 70000,
    fuelType: "petrol" as const,
    transmission: "manual" as const,
    color: "White",
    tags: ["toyota", "etios liva", "petrol", "hatchback", "manual"],
  },
  {
    name: "Renault Kwid RXT",
    slug: "renault-kwid-rxt",
    price: "320000.00",
    description: "2021 Renault Kwid RXT petrol, stylish entry-level car with touchscreen.",
    brand: "Renault",
    model: "Kwid",
    variant: "RXT",
    year: 2021,
    mileageKm: 20000,
    fuelType: "petrol" as const,
    transmission: "manual" as const,
    color: "Blue",
    tags: ["renault", "kwid", "petrol", "hatchback", "manual"],
  },
  {
    name: "Honda Amaze S",
    slug: "honda-amaze-s",
    price: "600000.00",
    description: "2020 Honda Amaze S petrol, comfortable compact sedan for family.",
    brand: "Honda",
    model: "Amaze",
    variant: "S",
    year: 2020,
    mileageKm: 40000,
    fuelType: "petrol" as const,
    transmission: "manual" as const,
    color: "Silver",
    tags: ["honda", "amaze", "petrol", "sedan", "manual"],
  },
  {
    name: "Ford EcoSport Titanium",
    slug: "ford-ecosport-titanium",
    price: "650000.00",
    description: "2019 Ford EcoSport Titanium petrol, sturdy build and great handling.",
    brand: "Ford",
    model: "EcoSport",
    variant: "Titanium",
    year: 2019,
    mileageKm: 50000,
    fuelType: "petrol" as const,
    transmission: "manual" as const,
    color: "White",
    tags: ["ford", "ecosport", "petrol", "suv", "manual"],
  },
  {
    name: "Volkswagen Polo Comfortline",
    slug: "volkswagen-polo-comfortline",
    price: "550000.00",
    description: "2018 Volkswagen Polo Comfortline petrol, premium hatchback with solid build quality.",
    brand: "Volkswagen",
    model: "Polo",
    variant: "Comfortline",
    year: 2018,
    mileageKm: 48000,
    fuelType: "petrol" as const,
    transmission: "manual" as const,
    color: "Red",
    tags: ["volkswagen", "polo", "petrol", "hatchback", "manual"],
  },
];

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required to run the sample data seed");
  }

  const client = postgres(databaseUrl, { prepare: false });
  const db = drizzle(client);

  try {
    const now = new Date();
    const sharedVirtualNumber =
      process.env.CENTRAL_AGENT_NUMBER || process.env.EXOTEL_VIRTUAL_NUMBER || process.env.EXOTEL_CALLER_ID || null;

    const businessValues = {
      businessName: "BuildYourVision Cars",
      slug: BUSINESS_SLUG,
      serviceType: "car_dealer" as const,
      businessType: "used_car_dealer",
      contactNumber: BUSINESS_NUMBER,
      primaryEmail: "cars@buildyourvision.example.com",
      primaryMobile: sharedVirtualNumber,
      forwardingNumber: sharedVirtualNumber,
      aiAgentPhoneNumber: sharedVirtualNumber,
      city: "Hyderabad",
      state: "Telangana",
      address: "BuildYourVision Cars, Hyderabad, Telangana",
      googleMapLink: "https://maps.google.com/?q=BuildYourVision+Cars+Hyderabad",
      planCode: "starter" as const,
      status: "active" as const,
      voiceAgentEnabled: true,
      metadata: {
        description: "Used car dealership in Hyderabad offering verified cars, test drives, exchange support, and finance assistance.",
        welcomeMessage: "Welcome to BuildYourVision Cars. How may I help you today?",
        planCode: "starter",
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

    await db
      .insert(businessSettings)
      .values({
        businessId: business.id,
        openingTime: "09:00:00",
        closingTime: "20:00:00",
        workingDays: ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"],
        bookingEnabled: true,
        autoAnswerEnabled: true,
        welcomeMessage: "Welcome to BuildYourVision Cars. How may I help you today?",
        fallbackMessage: "Please share your name, phone number, and preferred car. Our sales team will call you back.",
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
          welcomeMessage: "Welcome to BuildYourVision Cars. How may I help you today?",
          fallbackMessage: "Please share your name, phone number, and preferred car. Our sales team will call you back.",
          updatedAt: now,
        },
      });

    for (const [index, car] of sampleCars.entries()) {
      await db
        .insert(products)
        .values({
          businessId: business.id,
          name: car.name,
          slug: car.slug,
          description: car.description,
          category: "car",
          itemType: "product",
          condition: "used",
          status: "available",
          sku: `BYVC-${String(index + 1).padStart(3, "0")}`,
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
          specifications: {
            ownership: "single owner",
            insurance: "valid",
            testDriveAvailable: true,
            financeAvailable: true,
            exchangeAccepted: true,
          },
          isNegotiable: true,
          isFeatured: index < 3,
          createdAt: now,
          updatedAt: now,
        })
        .onConflictDoUpdate({
          target: [products.businessId, products.slug],
          set: {
            name: car.name,
            description: car.description,
            category: "car",
            itemType: "product",
            condition: "used",
            status: "available",
            sku: `BYVC-${String(index + 1).padStart(3, "0")}`,
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
            specifications: {
              ownership: "single owner",
              insurance: "valid",
              testDriveAvailable: true,
              financeAvailable: true,
              exchangeAccepted: true,
            },
            isNegotiable: true,
            isFeatured: index < 3,
            updatedAt: now,
          },
        });
    }

    const seededProducts = await db.select({ id: products.id }).from(products).where(eq(products.businessId, business.id));

    console.log(`Seeded ${business.businessName} with business number ${business.contactNumber}`);
    console.log(`Business ID: ${business.id}`);
    console.log(`Products/services for this business: ${seededProducts.length}`);

    // Seed Ganesh Car Rentals
    const ganeshBusinessValues = {
      businessName: "Ganesh car rentals",
      slug: GANESH_BUSINESS_SLUG,
      serviceType: "car_dealer" as const,
      businessType: "used_car_dealer",
      contactNumber: GANESH_BUSINESS_NUMBER,
      primaryEmail: "ganeshcars@example.com",
      primaryMobile: sharedVirtualNumber,
      forwardingNumber: sharedVirtualNumber,
      aiAgentPhoneNumber: sharedVirtualNumber,
      city: "Srikakulam",
      state: "Andhra Pradesh",
      address: "opposite rajeswari traders , narasannapeta , srikakulam , andhra pradesh",
      googleMapLink: "https://maps.google.com/?q=Narasannapeta+Srikakulam",
      planCode: "starter" as const,
      status: "active" as const,
      voiceAgentEnabled: true,
      metadata: {
        description: "Car rentals and used cars dealership in Narasannapeta, Srikakulam.",
        welcomeMessage: "Welcome to Ganesh car rentals. How may I help you today?",
        planCode: "starter",
      },
      updatedAt: now,
    };

    const [ganeshBusiness] = await db
      .insert(businesses)
      .values({
        ...ganeshBusinessValues,
        createdAt: now,
      })
      .onConflictDoUpdate({
        target: businesses.contactNumber,
        set: ganeshBusinessValues,
      })
      .returning();

    await db
      .insert(businessSettings)
      .values({
        businessId: ganeshBusiness.id,
        openingTime: "09:00:00",
        closingTime: "20:00:00",
        workingDays: ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"],
        bookingEnabled: true,
        autoAnswerEnabled: true,
        welcomeMessage: "Welcome to Ganesh car rentals. How may I help you today?",
        fallbackMessage: "Please share your name, phone number, and query. Our team will call you back.",
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
          welcomeMessage: "Welcome to Ganesh car rentals. How may I help you today?",
          fallbackMessage: "Please share your name, phone number, and query. Our team will call you back.",
          updatedAt: now,
        },
      });

    for (const [index, car] of ganeshSampleCars.entries()) {
      await db
        .insert(products)
        .values({
          businessId: ganeshBusiness.id,
          name: car.name,
          slug: car.slug,
          description: car.description,
          category: "car",
          itemType: "product",
          condition: "used",
          status: "available",
          sku: `GANESH-${String(index + 1).padStart(3, "0")}`,
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
          locationCity: "Srikakulam",
          locationState: "Andhra Pradesh",
          conditionNotes: "Test drive available by appointment.",
          searchTags: car.tags,
          specifications: {
            ownership: "single owner",
            insurance: "valid",
            testDriveAvailable: true,
            financeAvailable: true,
            exchangeAccepted: true,
          },
          isNegotiable: true,
          isFeatured: index < 3,
          createdAt: now,
          updatedAt: now,
        })
        .onConflictDoUpdate({
          target: [products.businessId, products.slug],
          set: {
            name: car.name,
            description: car.description,
            category: "car",
            itemType: "product",
            condition: "used",
            status: "available",
            sku: `GANESH-${String(index + 1).padStart(3, "0")}`,
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
            locationCity: "Srikakulam",
            locationState: "Andhra Pradesh",
            conditionNotes: "Test drive available by appointment.",
            searchTags: car.tags,
            specifications: {
              ownership: "single owner",
              insurance: "valid",
              testDriveAvailable: true,
              financeAvailable: true,
              exchangeAccepted: true,
            },
            isNegotiable: true,
            isFeatured: index < 3,
            updatedAt: now,
          },
        });
    }

    const ganeshSeededProducts = await db.select({ id: products.id }).from(products).where(eq(products.businessId, ganeshBusiness.id));

    console.log(`Seeded ${ganeshBusiness.businessName} with business number ${ganeshBusiness.contactNumber}`);
    console.log(`Business ID: ${ganeshBusiness.id}`);
    console.log(`Products/services for this business: ${ganeshSeededProducts.length}`);
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
