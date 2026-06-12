id="58291"}
# SanamSpace_UX_Folder_Structure_v1.md

# SanamSpace UX Documentation Structure

Version: 1.0

---

# Purpose

เอกสารนี้กำหนดมาตรฐานการจัดเก็บเอกสาร UX ทั้งหมดของระบบ SanamSpace

เพื่อให้

- UX Designer
- UI Designer
- Product Owner
- Developer
- QA
- Claude
- Cursor

สามารถทำงานร่วมกันได้โดยไม่สับสน

---

# UX Root Structure

text docs/  └── ux/ 

---

# Main UX Structure

text docs/ux/  ├── customer/ ├── owner/ ├── super-admin/ ├── shared/ ├── flows/ ├── wireframes/ ├── prototypes/ └── research/ 

---

# Customer Application

text docs/ux/customer/ 

เอกสารทั้งหมดของผู้ใช้งานสนาม

---

## Folder Structure

text customer/  ├── 01_Authentication/ ├── 02_Home/ ├── 03_Venue/ ├── 04_Court/ ├── 05_Booking/ ├── 06_Payment/ ├── 07_Membership/ ├── 08_Wallet/ ├── 09_Profile/ ├── 10_Notification/ ├── 11_Package/ └── 12_Settings/ 

---

## Authentication

text 01_Authentication/  Login.md  LINE_Login.md  Register.md  Account_Link.md 

---

## Home

text 02_Home/  Home.md  Venue_List.md  Search.md  Favorites.md 

---

## Venue

text 03_Venue/  Venue_Detail.md  Venue_Map.md  Facilities.md  Gallery.md 

---

## Court

text 04_Court/  Court_List.md  Court_Detail.md  Schedule.md 

---

## Booking

text 05_Booking/  Create_Booking.md  Booking_Confirmation.md  Booking_History.md  Booking_Cancel.md  Check_In.md  Check_Out.md 

---

## Payment

text 06_Payment/  Payment_Method.md  Transfer.md  Upload_Slip.md  Payment_Status.md  Refund.md 

---

# Owner Portal

text docs/ux/owner/ 

---

## Folder Structure

text owner/  ├── 01_Dashboard/ ├── 02_Booking/ ├── 03_Court/ ├── 04_Customer/ ├── 05_CRM/ ├── 06_Membership/ ├── 07_Promotion/ ├── 08_Payment/ ├── 09_Report/ ├── 10_Settings/ └── 11_Staff/ 

---

## Dashboard

text Dashboard.md  KPI_Cards.md  Revenue_Widget.md  Booking_Widget.md 

---

## Booking

text Booking_Calendar.md  Booking_List.md  Booking_Detail.md  Check_In.md  Check_Out.md 

---

## CRM

text Customer_Segments.md  Broadcast.md  Customer_Timeline.md  Follow_Up.md 

---

# Super Admin

text docs/ux/super-admin/ 

---

## Folder Structure

text super-admin/  ├── 01_Organizations/ ├── 02_Subscriptions/ ├── 03_Plans/ ├── 04_Features/ ├── 05_Billing/ ├── 06_Analytics/ └── 07_System_Settings/ 

---

# Shared Components

text docs/ux/shared/ 

ใช้ร่วมกันทุกระบบ

---

## Structure

text shared/  Buttons.md  Forms.md  Tables.md  Cards.md  Modals.md  Date_Picker.md  Calendar.md  Upload.md  Empty_State.md  Loading_State.md  Error_State.md 

---

# User Flows

text docs/ux/flows/ 

---

## Customer Flows

text Customer_Login_Flow.md  Booking_Flow.md  Payment_Flow.md  Membership_Flow.md 

---

## Owner Flows

text Owner_Booking_Management.md  Owner_CRM_Flow.md  Owner_Promotion_Flow.md 

---

# Wireframes

text docs/ux/wireframes/ 

---

## Structure

text wireframes/  customer/  owner/  super-admin/ 

---

## Naming Standard

text WF-CUS-001-Login.png  WF-CUS-002-Home.png  WF-CUS-003-Venue.png  WF-OWN-001-Dashboard.png  WF-ADM-001-Organizations.png 

---

# Prototypes

text docs/ux/prototypes/ 

---

## Structure

text prototypes/  customer/  owner/  super-admin/ 

---

## Naming Standard

text PT-CUS-v1.fig  PT-OWN-v1.fig  PT-ADM-v1.fig 

---

# UX Research

text docs/ux/research/ 

---

## Structure

text research/  Personas.md  User_Journey.md  Interview_Notes.md  Pain_Points.md  Competitor_Research.md 

---

# UX File Template

ทุกไฟล์ UX ต้องใช้โครงสร้างนี้

markdown # Screen Name  ## Objective  ## User Story  ## Entry Point  ## Exit Point  ## Components  ## Validation Rules  ## API Dependencies  ## Edge Cases  ## Success Criteria 

---

# Naming Convention

## Customer

text CUS- 

---

## Owner

text OWN- 

---

## Super Admin

text ADM- 

---

# Example

text CUS-BOOK-001  Customer Booking Screen 

---

# Documentation Rules

Rule 1

1 Screen = 1 File

---

Rule 2

1 Flow = 1 File

---

Rule 3

ทุก Screen ต้องมี

text User Story  Components  Validation  API Dependency 

---

Rule 4

ทุก Flow ต้องมี Diagram

---

Rule 5

ห้ามเก็บ UX ไว้นอก

text docs/ux/ 

---

# Final Goal

โครงสร้างนี้รองรับ

- UX Designer
- UI Designer
- Product Team
- Developer
- QA
- Claude
- Cursor

ให้สามารถค้นหา Screen และ Flow