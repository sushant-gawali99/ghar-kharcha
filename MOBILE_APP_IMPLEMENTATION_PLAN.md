# Grocery Analysis Mobile App Implementation Plan

## Overview

This document outlines the recommended approach for building the Grocery Analysis app for Android and iOS as a standalone mobile product.

The goal is to ship a premium, mobile-first app that allows users to:

- Upload grocery invoice PDFs from Zepto and Swiggy Instamart
- Parse item-level grocery data
- View grocery analytics and trends
- Track orders and repeat purchases
- Understand grocery spending patterns over time

## Recommended Tech Stack

### Mobile App

- Framework: `React Native` with `Expo`
- Language: `TypeScript`
- Navigation: `Expo Router`
- Server state: `TanStack Query`
- Local app state: `Zustand`
- Forms: `React Hook Form` + `Zod`
- Animations: `React Native Reanimated`
- File selection: `expo-document-picker`
- Secure storage: `expo-secure-store`
- Notifications: `expo-notifications`
- Charts: `react-native-svg` + `victory-native` or `react-native-gifted-charts`

### Backend

Keep the existing backend and extend it for mobile use:

- Backend: `Node.js + Express`
- Database: `MySQL`
- ORM: `Drizzle ORM`
- PDF processing: existing invoice parsing logic on the server

### Build and Release

- Build pipeline: `EAS Build`
- OTA updates: `EAS Update`
- App store submission: `EAS Submit`

## Why This Stack

This is the most practical stack for this project because:

- The current product already uses React and TypeScript
- It allows reuse of frontend skills and shared domain types
- Expo reduces native setup overhead
- The backend can continue handling PDF parsing and analytics aggregation
- Android and iOS can be shipped from one codebase with low operational overhead

## Product Scope for v1

### Core Screens

- Welcome / onboarding
- Login / authentication
- Analytics home
- Grocery orders list
- Grocery order detail
- Upload invoices
- Items insights
- Profile / settings

### Core v1 Use Cases

- Upload invoices from phone
- View grocery spending summary
- Compare spending across months
- View order history
- Inspect order details and parsed items
- Track repeated products
- Understand fees, taxes, and discounts

## Recommended Architecture

### Mobile Responsibilities

- Authentication
- PDF selection and upload
- Dashboard rendering
- Orders and item insights UI
- Budgets and reminders UI
- Notifications and local preferences

### Backend Responsibilities

- Invoice parsing
- Duplicate invoice detection
- Analytics aggregation
- Product normalization
- Price history and item intelligence
- Notification triggers
- Device token registration

### Suggested Project Structure

```text
apps/mobile
packages/shared-types
packages/api-client
packages/design-tokens
```

If you do not want a monorepo split immediately, start with:

```text
mobile/
```

and extract shared packages later.

## Backend Work Recommended for Mobile

The current backend is a strong base, but mobile will benefit from these additions:

- Versioned mobile endpoints such as `/api/mobile/v1`
- Mobile-friendly auth and token refresh endpoints
- Aggregated dashboard endpoint for fewer network calls
- Paginated orders endpoint
- Item insights endpoint with normalized products
- Upload job/status endpoint
- Push notification device token endpoint
- Structured parse error responses

## Shared Domain Models to Reuse

Reuse shared types and constants where possible:

- Grocery categories
- Grocery platform types
- Order summary DTOs
- Order detail DTOs
- Analytics response DTOs
- Upload result DTOs

## 8-Week Implementation Roadmap

## Week 1: Foundation

### Goals

- Set up the Expo mobile app
- Create the base architecture
- Establish the design system and app shell

### Tasks

- Initialize `Expo + TypeScript + Expo Router`
- Set up:
  - query client
  - API client
  - auth store
  - env config
  - error handling
- Define theme tokens:
  - colors
  - spacing
  - typography
  - radius
  - shadows
- Create UI primitives:
  - `Screen`
  - `Card`
  - `Button`
  - `Badge`
  - `MetricCard`
  - `EmptyState`
  - `Loader`
  - `SectionHeader`
- Define shared mobile types for grocery features

### Deliverable

- App runs on Android and iOS simulator
- Base navigation works
- Core design system is in place

## Week 2: Authentication and Onboarding

### Goals

- Let users sign in and stay signed in
- Build the first-run experience

### Tasks

- Implement authentication flow
- Preferred path:
  - Google sign-in first
  - OTP/email can be added later
- Store session securely using `expo-secure-store`
- Add:
  - welcome screen
  - sign-in screen
  - session restore on launch
  - logout flow
  - basic settings shell
- Backend work:
  - mobile auth endpoints
  - refresh token support
  - session/device handling

### Deliverable

- User can sign in and access the app shell

## Week 3: Upload Invoices

### Goals

- Build a reliable invoice upload flow from mobile

### Tasks

- Implement multi-PDF selection using `expo-document-picker`
- Build upload UI:
  - selected files list
  - remove file action
  - upload CTA
  - upload progress
  - per-file status
- Show result states:
  - success
  - duplicate
  - failed parse
- Add upload history
- Backend work:
  - duplicate detection improvements
  - stable per-file result payload
  - better parse error codes
  - optional async processing for large batches

### Deliverable

- User can upload grocery invoice PDFs and see structured results

## Week 4: Analytics Home

### Goals

- Build the main value screen of the app

### Tasks

- Build dashboard with:
  - month/year filters
  - total spend
  - total orders
  - total items
  - average spend per order
  - fees
  - taxes
  - discounts
  - category spend chart
  - platform comparison
  - monthly trend
  - top recurring items
  - smart insight cards
- Add loading skeletons and empty states
- Backend work:
  - aggregate dashboard endpoint if needed

### Deliverable

- Analytics home is powered by real backend data

## Week 5: Orders and Order Detail

### Goals

- Let users browse their grocery history and inspect each order

### Tasks

- Build orders list screen:
  - summary strip
  - filters
  - order cards
  - delete order action
- Build order detail screen:
  - summary card
  - invoice metadata
  - fee/tax/discount breakdown
  - item list
  - category badges/icons
- Backend work:
  - pagination
  - order detail payload refinement
  - safe delete flow

### Deliverable

- Orders and order detail screens are usable end to end

## Week 6: Items Insights

### Goals

- Surface repeat purchase behavior and product intelligence

### Tasks

- Build items insights screen:
  - search
  - category filters
  - month/year filters
  - grouped item list
  - frequency
  - total spend
  - average price
  - last purchased
- Backend work:
  - item normalization
  - item-level aggregates
  - product price history

### Deliverable

- Users can explore repeat items and category behavior

## Week 7: Retention Features and Quality

### Goals

- Add the first features that improve retention
- Improve observability and reliability

### Tasks

- Add budget features:
  - monthly grocery budget
  - overspend indicator
- Add smart insights:
  - fee awareness
  - platform comparisons
  - repeated purchase highlights
- Add analytics events:
  - onboarding complete
  - upload started/completed
  - dashboard viewed
  - order opened
  - item search used
- Add crash/error monitoring
- Performance improvements:
  - query caching
  - list optimization
  - loading polish

### Deliverable

- App is stable, measurable, and more habit-forming

## Week 8: QA and Release Preparation

### Goals

- Prepare a beta-ready release for Android and iOS

### Tasks

- End-to-end QA across all flows
- Fix edge cases:
  - invalid PDF
  - duplicate invoice
  - slow network
  - empty states
  - retry paths
- Add:
  - app icon
  - splash screen
  - screenshots
  - privacy policy
  - store listing content
- Configure:
  - EAS Build
  - TestFlight
  - Android internal testing

### Deliverable

- Release candidate ready for internal or beta testing

## MVP Definition

The MVP should include:

- Authentication
- Welcome / onboarding
- Upload invoices
- Analytics home
- Orders list
- Order detail
- Items insights
- Basic settings
- Budget indicator

## Features to Prioritize After MVP

- Price trend by item
- Platform-wise savings insights
- Repeat purchase reminders
- Push notifications
- Shared household accounts
- Premium subscription features
- OCR support for image receipts

## Retention Features Worth Considering

These are the most promising features for long-term user value:

- Repeat item tracking
- Average price tracking per item
- Platform comparison
- Budget alerts
- Smart savings suggestions
- Monthly grocery report
- “You paid this much in fees” insights

## Suggested Success Metrics

Track these from the beginning:

- Upload success rate
- Parse failure rate
- Duplicate invoice rate
- Weekly active users
- Users uploading 3 or more invoices
- Dashboard return rate
- Order detail open rate
- Item search usage
- Retention after first successful upload

## Recommended Immediate Next Steps

1. Create the mobile app with Expo
2. Define the shared API contracts for mobile
3. Build authentication and invoice upload first
4. Build the analytics home next
5. Use internal beta testing before investing in advanced features

## Final Recommendation

Build the mobile app using `React Native + Expo + TypeScript`, reuse your existing backend, and keep invoice parsing on the server.

This gives you:

- fastest delivery
- lowest platform risk
- strong TypeScript reuse
- simpler Android + iOS release management
- easier iteration on product features

