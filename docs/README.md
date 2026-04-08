เป้าหมายของระบบ

ทำระบบสำหรับงานอีเวนต์ผ่าน LINE OA เพื่อ
	•	ให้ผู้ใช้ลงทะเบียน / จองเข้างาน
	•	ให้แอดมินตรวจสอบรายการ
	•	ให้แอดมินอนุมัติ
	•	ส่งรหัสจองหรือ QR ให้ผู้ใช้
	•	ใช้สำหรับเช็คอินหน้างานได้

แนวคิด MVP flow หลักนี้ (ปรับให้พร้อมใช้งานจริง)

ฝั่งผู้ใช้ (User Flow)
	1.	กดเมนูจาก LINE OA และเปิด LIFF
	2.	ระบบดึง LIFF Profile (lineUserId, displayName)
	3.	ผู้ใช้กรอกข้อมูลลงทะเบียน + จำนวนที่นั่ง + แนบสลิป
	4.	ระบบ validate เงื่อนไข (ที่นั่งคงเหลือ, กันลงซ้ำ)
	5.	บันทึก booking เป็น `waiting_payment_review` หรือ `pending`
	6.	ผู้ใช้ดูสถานะได้ที่ `/liff/status`
	7.	เมื่ออนุมัติ ระบบส่ง booking code/QR ผ่าน LINE OA
	8.	วันงานแสดง QR/รหัสให้ทีมหน้างานเช็คอิน

ฝั่งแอดมิน (Admin Flow)
	1.	ล็อกอินหลังบ้าน
	2.	ดูรายการจอง และ filter ตามสถานะ
	3.	ตรวจสอบสลิป / หลักฐานชำระเงิน
	4.	กด approve / cancel / mark paid
	5.	ระบบ generate booking code + QR อัตโนมัติเมื่อ approve
	6.	หน้างานค้นหาด้วยชื่อ / เบอร์ / booking code หรือสแกน QR
	7.	กดเช็คอิน และระบบบล็อกเช็คอินซ้ำ

ฟีเจอร์หลักๆ

1) ผู้ใช้ลงทะเบียน

เก็บข้อมูล:
	•	ชื่อ
	•	เบอร์โทร
	•	LINE User ID
	•	ชื่อบน LINE
	•	จำนวนที่นั่ง
	•	อัปโหลดสลิป
	•	หมายเหตุ

2) ดูสถานะการจอง

สถานะเช่น:
	•	pending
	•	waiting_payment_review
	•	confirmed
	•	cancelled
	•	checked_in

3) แอดมินจัดการรายการ
	•	ดูรายการทั้งหมด
	•	filter ตามสถานะ
	•	approve
	•	cancel
	•	mark paid

4) เช็คอินหน้างาน
	•	สแกน QR Code
	•	ค้นหาด้วยชื่อ
	•	ค้นหาด้วยเบอร์โทร
	•	ค้นหาด้วย booking code

โครงสร้างหน้าระบบ

ฝั่งผู้ใช้
	•	/liff/register หน้าลงทะเบียน
	•	/liff/status หน้าตรวจสอบสถานะ
	•	/booking/[code] หน้ายืนยันการจอง / แสดง QR

ฝั่งแอดมิน
	•	/admin/login
	•	/admin/dashboard
	•	/admin/bookings
	•	/admin/bookings/[id]
	•	/admin/checkin


โครงสร้างโฟลเดอร์ (เวอร์ชันแนะนำให้ maintain ง่ายขึ้น)
src/
├── app/
│   ├── (public)/
│   │   ├── booking/
│   │   │   └── [code]/page.tsx
│   │   └── page.tsx
│   ├── liff/
│   │   ├── register/page.tsx
│   │   └── status/page.tsx
│   ├── admin/
│   │   ├── (auth)/
│   │   │   └── login/page.tsx
│   │   └── (protected)/
│   │       ├── dashboard/page.tsx
│   │       ├── bookings/page.tsx
│   │       ├── bookings/[id]/page.tsx
│   │       └── checkin/page.tsx
│   └── api/
│       ├── liff/
│       │   └── profile/route.ts
│       ├── bookings/
│       │   ├── route.ts
│       │   ├── [id]/route.ts
│       │   ├── [id]/approve/route.ts
│       │   ├── [id]/cancel/route.ts
│       │   ├── [id]/mark-paid/route.ts
│       │   └── checkin/route.ts
│       ├── upload/
│       │   └── slip/route.ts
│       └── webhook/
│           └── line/route.ts
├── prisma/
│   ├── schema.prisma
│   ├── migrations/
│   └── seed.ts
├── components/
│   ├── forms/
│   │   └── RegisterForm.tsx
│   ├── admin/
│   │   ├── BookingTable.tsx
│   │   ├── CheckinSearch.tsx
│   │   └── StatusBadge.tsx
│   └── shared/
│       ├── Button.tsx
│       ├── Input.tsx
│       └── Card.tsx
├── lib/
│   ├── prisma.ts
│   ├── line.ts
│   ├── qr.ts
│   ├── auth.ts
│   ├── booking.ts
│   ├── capacity.ts
│   └── utils.ts
├── server/
│   ├── repositories/
│   │   └── booking.repo.ts
│   ├── services/
│   │   ├── booking.service.ts
│   │   ├── checkin.service.ts
│   │   └── notification.service.ts
│   └── validators/
│       ├── booking.validator.ts
│       └── checkin.validator.ts
├── types/
│   └── booking.ts
├── constants/
│   └── booking-status.ts
├── config/
│   └── event.ts
└── middleware.ts

หมายเหตุการปรับโครงสร้าง
	•	แยก `admin/(auth)` และ `admin/(protected)` เพื่อคุมสิทธิ์ route ชัดเจน
	•	แยก `server/services` ออกจาก UI เพื่อลด business logic ใน route/page
	•	ย้าย schema/migration ไป `prisma/` ตาม convention ของ Prisma
	•	เพิ่ม `config/event.ts` สำหรับค่าปรับได้ เช่น capacity ที่นั่ง

⸻

Step Flow ที่แนะนำ (สถานะมาตรฐาน)

Registration + Approval
	1.	create booking -> `pending`
	2.	แนบสลิป -> `waiting_payment_review`
	3.	admin ตรวจสอบ
	4.	ผ่าน -> `confirmed` (generate code + QR + notify LINE)
	5.	ไม่ผ่าน -> `cancelled` (notify LINE พร้อมเหตุผล)

Onsite Check-in
	1.	scan/search booking
	2.	ตรวจสถานะ ต้องเป็น `confirmed`
	3.	update เป็น `checked_in` + set `checkedInAt`
	4.	ถ้าสถานะเป็น `checked_in` อยู่แล้ว ให้ตอบกลับว่าเช็คอินแล้ว (ห้ามซ้ำ)

เงื่อนไขจำเป็น ประกอบด้วย

1) จำกัดจำนวนที่นั่ง

ตอนนี้กำหนดคนเข้างานนี้มี 40 ที่นั่ง ** หากสามารถกำหนดเพิ่มได้ตอนหลัง หรือเปลี่ยนแปลงได้จะดีมาก

เวลา submit booking ต้องเช็กว่า
	•	จำนวนที่ยืนยันแล้วรวมกับรายการใหม่
	•	ต้องไม่เกิน 40

ตัวอย่าง logic:
	•	นับเฉพาะ booking ที่ status = CONFIRMED หรือ CHECKED_IN
	•	หรือจะรวม WAITING_REVIEW ด้วยก็ได้ ถ้าต้องการกันที่ไว้ก่อน

⸻

2) กันลงทะเบียนซ้ำ

แนะนำกันซ้ำแบบนี้ก่อน
	•	1 LINE user ลงได้ 1 booking
หรือ
	•	1 LINE user ลงได้หลาย booking แต่แนะนำยังไม่เปิด

สำหรับงานนี้ควรเริ่มจาก
	•	1 LINE user = 1 booking

⸻

3) เช็คอินซ้ำไม่ได้

เมื่อเช็คอินแล้ว
	•	เปลี่ยน bookingStatus = CHECKED_IN
	•	set checkedInAt
	•	ถ้ามีคนสแกนหรือค้นหาอีก ให้ขึ้นว่าเช็คอินแล้ว

⸻

Roadmap การพัฒนา (แบ่งเป็นเฟส)

Phase 0: Foundation / Project Setup
เป้าหมาย: ตั้งโครงโปรเจกต์ให้พร้อมพัฒนาและ deploy
	•	สร้างโปรเจกต์ Next.js (App Router) + Tailwind CSS
	•	ตั้งค่า Environment Variables
		•	DATABASE_URL
		•	LINE_CHANNEL_ACCESS_TOKEN
		•	LINE_CHANNEL_SECRET
		•	LIFF_ID
		•	APP_BASE_URL
	•	ติดตั้ง Prisma และเชื่อมต่อ MySQL/PostgreSQL
	•	ออกแบบ Prisma Schema เบื้องต้น (Booking, AdminUser, CheckinLog)
	•	วางมาตรฐานโค้ด (eslint, prettier, naming convention)
	•	เตรียม seed data สำหรับ dev/test

Phase 1: Core Booking MVP
เป้าหมาย: ให้ผู้ใช้ลงทะเบียนได้ และแอดมินเห็นรายการได้
	•	ทำหน้า `/liff/register` พร้อม validation
	•	ทำ API `POST /api/bookings` เพื่อบันทึกข้อมูลลง DB
	•	ทำหน้า `/liff/status` เพื่อตรวจสอบสถานะการจอง
	•	ทำหน้า `/admin/login`, `/admin/bookings` แบบพื้นฐาน
	•	ทำ list/filter booking ตาม status
	•	กันลงทะเบียนซ้ำ (1 LINE user = 1 booking)
	•	เริ่มใส่กติกาจำกัดที่นั่ง (capacity = 40)

Phase 2: Payment Review + Approval Flow
เป้าหมาย: ทำ flow ชำระเงิน/ตรวจสอบ/อนุมัติให้ครบ
	•	อัปโหลดสลิปผ่าน `POST /api/upload/slip`
	•	ทำสถานะ waiting_payment_review
	•	แอดมิน mark paid / approve / cancel
	•	เมื่อ approve ให้ generate booking code และ QR
	•	เก็บประวัติการเปลี่ยนสถานะ (audit log เบื้องต้น)
	•	ทำหน้ารายละเอียด booking `/admin/bookings/[id]`

Phase 3: Check-in Onsite
เป้าหมาย: เช็คอินหน้างานได้เร็ว และป้องกันเช็คอินซ้ำ
	•	ทำหน้า `/admin/checkin` รองรับ scan + search
	•	ทำ API check-in (`POST /api/bookings/checkin`)
	•	รองรับค้นหาด้วยชื่อ/เบอร์/booking code
	•	อัปเดตสถานะเป็น CHECKED_IN พร้อม `checkedInAt`
	•	ถ้าเช็คอินแล้วให้แจ้งเตือนว่าเช็คอินแล้ว
	•	บันทึกข้อมูลผู้ทำรายการเช็คอินและเวลา

Phase 4: LINE Integration (LIFF + Messaging API)
เป้าหมาย: เชื่อมประสบการณ์ผู้ใช้ผ่าน LINE OA แบบครบ flow
	•	ดึง LIFF profile และ bind กับ booking
	•	เพิ่ม webhook `/api/webhook/line`
	•	ส่งข้อความแจ้งสถานะผ่าน LINE Messaging API
		•	ลงทะเบียนสำเร็จ
		•	อนุมัติแล้ว + ส่ง booking code/QR
		•	ยกเลิกหรือข้อมูลไม่ครบ
	•	ทดสอบกรณี token หมดอายุ/เรียก API ไม่สำเร็จ

Phase 5: Hardening / UAT / Go-live
เป้าหมาย: พร้อมใช้งานจริงแบบเสถียร
	•	เพิ่ม error handling และ logging ให้ครบทุก API
	•	ป้องกัน race condition เรื่องจำนวนที่นั่ง (transaction/locking)
	•	ทำ role/permission ฝั่งแอดมินให้ชัดเจน
	•	เพิ่ม dashboard ตัวเลขสำคัญ (ยอดลงทะเบียน, confirmed, checked-in)
	•	ทำ UAT checklist + test case สำคัญ
	•	เตรียม deployment + backup/restore DB + rollback plan

⸻

Checklist การพัฒนา

1) Infrastructure / Setup
- [x] สร้าง Next.js + Tailwind + TypeScript project
- [x] ติดตั้ง Prisma และ migrate DB
- [x] ตั้งค่า `.env` สำหรับ LIFF, LINE Messaging API, Database (`.env.example`)
- [x] สร้าง `lib/prisma.ts` และ DB connection strategy
- [x] ตั้ง lint/format baseline (ESLint พร้อมใช้งาน)

2) Database & Domain
- [x] ออกแบบตาราง Booking (status, seats, bookingCode, checkedInAt, lineUserId)
- [x] ออกแบบตาราง AdminUser
- [x] ออกแบบตาราง CheckinLog / BookingStatusLog
- [x] ใส่ unique constraint: `lineUserId` (ช่วง MVP)
- [x] วาง index สำหรับ query ที่ใช้บ่อย (status, bookingCode, phone)

3) User Flow (LIFF)
- [x] ทำ LIFF bootstrap และตรวจสอบ login state
- [x] ทำฟอร์มลงทะเบียนพร้อม validation
- [x] อัปโหลดสลิปและบันทึก path/url
- [x] ทำหน้าตรวจสอบสถานะ (`/liff/status`)
- [x] ทำหน้ายืนยันการจอง (`/booking/[code]`)

4) Admin Flow
- [x] Login หลังบ้าน
- [x] Booking list + filter + search
- [x] Booking detail + approve/cancel/mark paid
- [x] Check-in หน้างาน (scan + search)
- [x] แสดงผลชัดเจนเมื่อเช็คอินซ้ำ

5) Business Rules
- [x] จำกัดจำนวนที่นั่งรวมไม่เกิน capacity (เริ่มต้น 40)
- [x] ปรับ capacity ได้จาก config หรือ admin setting
- [x] กันลงทะเบียนซ้ำตาม LINE User ID
- [x] กันเช็คอินซ้ำ (idempotent check-in)
- [x] รองรับการเปลี่ยนสถานะตามลำดับที่ถูกต้องเท่านั้น

6) LINE Messaging API
- [x] สร้าง utility สำหรับ push message
- [x] ส่งข้อความเมื่อ approve/cancel/check-in (ถ้าต้องการ)
- [x] สร้างและทดสอบ webhook endpoint
- [x] จัดการ retry/timeout/error จาก LINE API

Local HTTPS สำหรับทดสอบ LINE (สำคัญ)
- LINE LIFF และ LINE Webhook ต้องใช้ URL แบบ `https` เท่านั้น
- โปรเจกต์นี้ติดตั้งตัวช่วย `localtunnel` แล้ว
  - รันแอป: `npm run dev`
  - เปิด tunnel https: `npm run tunnel`
  - หรือรันพร้อมกัน: `npm run dev:tunnel`
- เอา URL ที่ได้จาก localtunnel ไปตั้งค่าใน LINE Developer Console:
  - LIFF URL: `<https-url>/liff/register`
  - Webhook URL: `<https-url>/api/webhook/line`
- ใช้ endpoint นี้สำหรับรับ event:
  - `POST /api/webhook/line`
- จุดที่เชื่อมต่อ LINE จริงในโค้ด:
  - `src/lib/line.ts` (push + retry + signature verify)
  - `src/app/api/bookings/[id]/approve/route.ts` (notify approve)
  - `src/app/api/bookings/[id]/cancel/route.ts` (notify cancel)
  - `src/app/api/bookings/checkin/route.ts` (notify check-in)

7) Security / Quality
- [x] ตรวจสอบ input และ sanitize ข้อมูล
- [x] ป้องกันการเข้าถึงหน้า admin โดยไม่ได้รับอนุญาต
- [x] เพิ่ม rate limit สำหรับ API สำคัญ
- [x] เพิ่ม log สำหรับ action สำคัญ (approve/check-in/cancel)
- [x] เขียน unit/integration test สำหรับ booking + check-in logic

8) UI Polish + System Validation
- [ ] ปรับ theme / spacing / typography ให้สอดคล้องทั้งระบบ
- [ ] ตรวจสอบ responsive บน mobile/tablet/desktop
- [ ] ทำ loading / empty / error states ให้ครบทุกหน้าหลัก
- [ ] ทำ smoke test ทุก flow (register -> approve -> booking page -> check-in)
- [ ] ทำ regression checklist หลังแก้ UI และ logic

9) Go-live Readiness
- [ ] เตรียม staging environment
- [ ] ทดสอบ end-to-end ตาม flow จริง
- [ ] ทำคู่มือหน้างานสำหรับทีม check-in
- [ ] เตรียม monitoring + alert เบื้องต้น
- [ ] สรุป runbook กรณีระบบล่ม/เชื่อม LINE ไม่ได้