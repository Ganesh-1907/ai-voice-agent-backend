import { relations } from "drizzle-orm";

import {
  businessFaqs,
  businesses,
  businessSettings,
  calls,
  callRequests,
  callTurns,
  categories,
  leads,
  orders,
  productFeatures,
  productImages,
  products,
  users,
} from "./schema";

export const businessesRelations = relations(businesses, ({ one, many }) => ({
  owner: one(users, {
    fields: [businesses.ownerUserId],
    references: [users.id],
    relationName: "businessOwner",
  }),
  users: many(users),
  settings: one(businessSettings),
  categories: many(categories),
  products: many(products),
  faqs: many(businessFaqs),
  calls: many(calls),
  leads: many(leads),
  orders: many(orders),
  callRequests: many(callRequests),
}));

export const usersRelations = relations(users, ({ one, many }) => ({
  business: one(businesses, {
    fields: [users.businessId],
    references: [businesses.id],
  }),
  ownedBusinesses: many(businesses, { relationName: "businessOwner" }),
}));

export const businessSettingsRelations = relations(businessSettings, ({ one }) => ({
  business: one(businesses, {
    fields: [businessSettings.businessId],
    references: [businesses.id],
  }),
}));

export const categoriesRelations = relations(categories, ({ one, many }) => ({
  business: one(businesses, {
    fields: [categories.businessId],
    references: [businesses.id],
  }),
  parent: one(categories, {
    fields: [categories.parentId],
    references: [categories.id],
    relationName: "categoryHierarchy",
  }),
  children: many(categories, { relationName: "categoryHierarchy" }),
  products: many(products),
}));

export const productsRelations = relations(products, ({ one, many }) => ({
  business: one(businesses, {
    fields: [products.businessId],
    references: [businesses.id],
  }),
  category: one(categories, {
    fields: [products.categoryId],
    references: [categories.id],
  }),
  features: many(productFeatures),
  images: many(productImages),
  leads: many(leads),
  orders: many(orders),
  callRequests: many(callRequests),
}));

export const productFeaturesRelations = relations(productFeatures, ({ one }) => ({
  product: one(products, {
    fields: [productFeatures.productId],
    references: [products.id],
  }),
}));

export const productImagesRelations = relations(productImages, ({ one }) => ({
  product: one(products, {
    fields: [productImages.productId],
    references: [products.id],
  }),
}));

export const businessFaqsRelations = relations(businessFaqs, ({ one }) => ({
  business: one(businesses, {
    fields: [businessFaqs.businessId],
    references: [businesses.id],
  }),
}));

export const callsRelations = relations(calls, ({ one, many }) => ({
  business: one(businesses, {
    fields: [calls.businessId],
    references: [businesses.id],
  }),
  turns: many(callTurns),
  leads: many(leads),
  orders: many(orders),
  callRequests: many(callRequests),
}));

export const callTurnsRelations = relations(callTurns, ({ one }) => ({
  call: one(calls, {
    fields: [callTurns.callId],
    references: [calls.id],
  }),
}));

export const leadsRelations = relations(leads, ({ one }) => ({
  business: one(businesses, {
    fields: [leads.businessId],
    references: [businesses.id],
  }),
  call: one(calls, {
    fields: [leads.callId],
    references: [calls.id],
  }),
  product: one(products, {
    fields: [leads.productId],
    references: [products.id],
  }),
}));

export const ordersRelations = relations(orders, ({ one }) => ({
  business: one(businesses, {
    fields: [orders.businessId],
    references: [businesses.id],
  }),
  call: one(calls, {
    fields: [orders.callId],
    references: [calls.id],
  }),
  product: one(products, {
    fields: [orders.productId],
    references: [products.id],
  }),
}));

export const callRequestsRelations = relations(callRequests, ({ one }) => ({
  business: one(businesses, {
    fields: [callRequests.businessId],
    references: [businesses.id],
  }),
  call: one(calls, {
    fields: [callRequests.callId],
    references: [calls.id],
  }),
  product: one(products, {
    fields: [callRequests.productId],
    references: [products.id],
  }),
}));
