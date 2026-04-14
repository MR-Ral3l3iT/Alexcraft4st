เป้าหมายของระบบ

ทำระบบสำหรับงานอีเวนต์ผ่าน LINE OA เพื่อ
	•	ให้ผู้ใช้ลงทะเบียน / จองเข้างาน
	•	ให้แอดมินตรวจสอบรายการ
	•	ให้แอดมินอนุมัติ
	•	ส่งรหัสจองหรือ QR ให้ผู้ใช้
	•	ใช้สำหรับเช็คอินหน้างานได้

แนวคิดขยาย (อ้างอิง `docs/NEW-IDEA.md`)
	•	ผูก **สถานะผู้ใช้** กับ **Rich Menu แบบ per-user** (priority สูงกว่า default) ผ่าน Messaging API — ผู้ใช้เห็นเฉพาะปุ่มที่เหมาะกับช่วงนั้น
	•	รองรับ **เช็คอินด้วยตนเองผ่าน LIFF** โดยใช้ Geolocation + รัศมีจากจุดจัดงาน + ช่วงเวลางาน (มี **fallback ให้แอดมินเช็คอิน** เมื่อ location ล้มเหลว)
	•	หลังเช็คอิน: **กิจกรรมในงาน** (เช่น นับแก้ว / เลเวล / cooldown / เพดานสูงสุด) และ **เช็คเอาท์** — บันทึก `checkedOutAt` แล้วส่ง **Flex สรุปค่ำคืน** ในแชท LINE (`src/lib/line-flex-checkout-complete.ts`) — การสลับ Rich Menu เป็นเมนู “Completed” ยังอิงสถานะ `BookingStatus` ใน DB (ดูหมายเหตุที่หัวข้อ Checkout ด้านล่าง)

สรุปสิ่งที่ต้องปรับเทียบกับโค้ดปัจจุบัน (เชิงสถาปัตยกรรม)
	1.	**โมเดลข้อมูล** — เพิ่มฟิลด์หรือตาราง เช่น **`EventSettings`** (capacity, พิกัด, รัศมี, ช่วงเวลา), `confirmedAt`, `checkedOutAt`, พิกัดเช็คอิน (lat/lng), `beerCount`, `beerLevel`, `lastDrinkAt`, `currentBadge` / `isCheckedOut` (หรือแยก `GameProfile`) — ใน checklist ให้วาง migration ใน **Step 2** ก่อน UI/API ตั้งค่า (Step 12)
	2.	**สถานะ / state machine** — แยก “ยังไม่มี booking” (Guest) ออกจากแถวในฐานข้อมูล; หลังเช็คอินอาจแยก `checked_in` vs `checked_out` / `completed` เพื่อ map Rich Menu “Checked-in” vs “Completed”
	3.	**LINE** — สร้าง Rich Menu หลายชุดใน LINE OA Manager (default) + เรียก API **link/unlink rich menu ต่อ userId** ทุกครั้งที่สถานะเปลี่ยน
	4.	**LIFF** — หน้าใหม่: เช็คอิน (ขอตำแหน่ง), เติมเบียร์/พลัง, เช็คเอาท์, ดูสรุป; ทุกหน้าเรียก `liff.init()` ตามเอกสาร LINE
	5.	**Backend** — API ตรวจรัศมี (Haversine), ช่วงเวลา, กติกา cooldown/max แก้ว; บันทึก audit สำหรับ self check-in / drink increment
	6.	**Admin** — คงหน้า check-in เดิมเป็น fallback; **โซนตั้งค่า** สำหรับ capacity + พิกัดงาน + พารามิเตอร์เช็คอิน; อาจเพิ่มหน้าดู game stats / force checkout ถ้าต้องการ
	7.	**Config / โซนตั้งค่าแอดมิน** — ตอนนี้ใช้นโยบาย **1 LINE ID = 1 booking = 1 ที่นั่ง (fix 1 ที่)**; ดังนั้น `capacity` คือ “จำนวนผู้เข้ารวม” ของงาน (ไม่ใช่จำนวนที่นั่งต่อ booking) ส่วนพิกัดงาน, รัศมี (เช่น 80–100 m), เวลาเปิดเช็คอิน, cooldown วินาที, max แก้วต่อคน ตั้งผ่านหน้า **`/admin/settings`** คู่ API **`GET/PATCH /api/admin/settings`**; env เป็นค่าเริ่มต้น/สำรองเมื่อยังไม่บันทึกใน DB
	8.	**เนื้อหา / นโยบาย** — ข้อความกิจกรรมควรสนุกแต่ไม่ส่งเสริมการดื่มหนัก (ตามข้อควรระวังใน NEW-IDEA)

แนวคิด MVP flow หลักนี้ (ปรับให้พร้อมใช้งานจริง)

ฝั่งผู้ใช้ (User Flow)
	1.	กดเมนูจาก LINE OA และเปิด LIFF
	2.	ระบบดึง LIFF Profile (lineUserId, displayName)
	3.	ผู้ใช้กรอกข้อมูลลงทะเบียน (ระบบกำหนด 1 booking = 1 ที่นั่ง) + แนบสลิป
	4.	ระบบ validate เงื่อนไข (ที่นั่งคงเหลือ, กันลงซ้ำ)
	5.	บันทึก booking เป็น `waiting_payment_review` หรือ `pending`
	6.	ผู้ใช้ดูสถานะได้ที่ `/liff/status`
	7.	เมื่ออนุมัติ ระบบส่ง booking code/QR ผ่าน LINE OA และ (เมื่อทำ Phase 6+) **สลับ Rich Menu** เป็นเมนู “Confirmed”
	8.	วันงาน: **เช็คอินด้วยตนเองผ่าน LIFF** (ตำแหน่งอยู่ในรัศมี + อยู่ในช่วงเวลา) หรือแสดง QR/รหัสให้ทีมหน้างานเช็คอินเป็น **fallback**
	9.	(ขยาย) หลังเช็คอิน: กิจกรรมในงาน (เช่น เติมพลัง/นับแก้วตามกติกา) แล้ว **เช็คเอาท์** เพื่อสรุปผลและสลับ Rich Menu เป็น “Completed”

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
	•	จำนวนที่นั่ง (fix = 1 ต่อ 1 LINE ID)
	•	อัปโหลดสลิป
	•	หมายเหตุ

2) ดูสถานะการจอง

สถานะเช่น (ปัจจุบันในโค้ด):
	•	pending
	•	waiting_payment_review
	•	confirmed
	•	cancelled
	•	checked_in

สถานะเชิง UX / LINE (จาก NEW-IDEA — map กับ DB + Rich Menu):
	•	**Guest** — ยังไม่มี booking (ไม่มีแถวในฐานข้อมูล) → Rich Menu: ลงทะเบียน / ดูสถานะ
	•	**Pending** — `pending` หรือ `waiting_payment_review` → Rich Menu: ดูสถานะ / ติดต่อ
	•	**Confirmed** — `confirmed` → Rich Menu: QR/รหัส, เปิด LIFF เช็คอิน (เมื่อมีฟีเจอร์)
	•	**Checked-in** — `checked_in` และยังไม่ checkout → Rich Menu: กิจกรรมในงาน, เช็คเอาท์
	•	**Completed** — เช็คเอาท์แล้ว (ต้องเพิ่มสถานะหรือฟิลด์ เช่น `checkedOutAt` / `checked_out`) → Rich Menu: สรุป / ขอบคุณ

ตารางอ้างอิง (Rich Menu ID เก็บใน env หรือ config):

| สถานะ UX    | เงื่อนไข DB (แนวทาง)              | Rich Menu (ตัวอย่าง)   |
|-------------|-------------------------------------|-------------------------|
| Guest       | ไม่มี booking สำหรับ lineUserId    | Default OA             |
| Pending     | pending / waiting_payment_review    | Pending menu           |
| Confirmed   | confirmed                           | Confirmed menu         |
| Checked-in  | checked_in, ยังไม่ checkout         | In-event menu          |
| Completed   | checkout แล้ว                      | Thank-you / summary    |

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
	•	/liff/callback หน้า callback หลัง LINE Login / LIFF redirect
	•	/liff/status หน้าตรวจสอบสถานะ
	•	/booking/[code] หน้ายืนยันการจอง / แสดง QR
	•	`/liff/checkin` — เช็คอินด้วย Geolocation + ช่วงเวลา + รัศมี (`POST /api/bookings/self-checkin`)
	•	`/liff/beer` — เติมแก้ว (+1) ตาม cooldown / เพดาน (`GET/POST /api/liff/drink`)
	•	`/liff/energy` — แสดงจำนวนแก้ว + ฉายา (อ่านจาก `GET /api/liff/drink`)
	•	`/liff/checkout` — เช็คเอาท์ / กลับบ้าน (`POST /api/bookings/self-checkout`) แล้วส่ง Flex สรุปใน LINE

ฝั่งแอดมิน
	•	/admin/login
	•	/admin/dashboard
	•	/admin/bookings
	•	/admin/bookings/[id]
	•	/admin/checkin
	•	`/admin/settings` — **โซนตั้งค่างาน**: จำนวนที่นั่งรวม (capacity), พิกัดจัดงาน, รัศมี/ช่วงเวลาเช็คอิน ฯลฯ (คู่ `GET/PATCH /api/admin/settings`)


โครงสร้างโฟลเดอร์ (เวอร์ชันแนะนำให้ maintain ง่ายขึ้น)
src/
├── app/
│   ├── (public)/
│   │   ├── booking/
│   │   │   └── [code]/page.tsx
│   │   └── page.tsx
│   ├── liff/
│   │   ├── register/page.tsx
│   │   ├── callback/page.tsx
│   │   ├── status/page.tsx
│   │   ├── checkin/page.tsx
│   │   ├── beer/page.tsx
│   │   ├── energy/page.tsx
│   │   └── checkout/page.tsx
│   ├── admin/
│   │   ├── (auth)/
│   │   │   └── login/page.tsx
│   │   └── (protected)/
│   │       ├── dashboard/page.tsx
│   │       ├── bookings/page.tsx
│   │       ├── bookings/[id]/page.tsx
│   │       ├── checkin/page.tsx
│   │       └── settings/page.tsx       (แนะนำ: capacity + พิกัด + พารามิเตอร์เช็คอิน)
│   └── api/
│       ├── liff/
│       │   ├── profile/route.ts
│       │   └── drink/route.ts
│       ├── bookings/
│       │   ├── route.ts
│       │   ├── [id]/route.ts
│       │   ├── [id]/approve/route.ts
│       │   ├── [id]/cancel/route.ts
│       │   ├── [id]/mark-paid/route.ts
│       │   ├── checkin/route.ts
│       │   ├── self-checkin/route.ts
│       │   └── self-checkout/route.ts
│       ├── upload/
│       │   └── slip/route.ts
│       ├── admin/
│       │   └── settings/route.ts         (GET/PATCH ตั้งค่างาน — capacity, พิกัด, รัศมี, ช่วงเวลา)
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
│   ├── line-richmenu.ts            (link/unlink rich menu ตามสถานะ booking)
│   ├── line-flex-drink-milestone.ts   (Flex milestone แก้ว 3/6/10)
│   ├── line-flex-checkout-complete.ts (Flex หลังเช็คเอาท์)
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
└── proxy.ts                        (route guard; โปรเจกต์นี้ใช้แทน middleware บางส่วน)

หมายเหตุการปรับโครงสร้าง
	•	แยก `admin/(auth)` และ `admin/(protected)` เพื่อคุมสิทธิ์ route ชัดเจน
	•	แยก `server/services` ออกจาก UI เพื่อลด business logic ใน route/page
	•	ย้าย schema/migration ไป `prisma/` ตาม convention ของ Prisma
	•	เพิ่ม `config/event.ts` สำหรับค่า default (capacity, พิกัด ฯลฯ) เมื่อยังไม่มีในฐานข้อมูล; ค่าจริงควรอ่านจาก **โซนตั้งค่าแอดมิน** เป็นหลัก

⸻

Step Flow ที่แนะนำ (สถานะมาตรฐาน)

Registration + Approval
	1.	create booking -> `pending`
	2.	แนบสลิป -> `waiting_payment_review`
	3.	admin ตรวจสอบ
	4.	ผ่าน -> `confirmed` (generate code + QR + notify LINE)
	5.	ไม่ผ่าน -> `cancelled` (notify LINE พร้อมเหตุผล)

Onsite Check-in (แอดมิน — มีอยู่แล้ว)
	1.	scan/search booking
	2.	ตรวจสถานะ ต้องเป็น `confirmed`
	3.	update เป็น `checked_in` + set `checkedInAt`
	4.	ถ้าสถานะเป็น `checked_in` อยู่แล้ว ให้ตอบกลับว่าเช็คอินแล้ว (ห้ามซ้ำ)

Self Check-in ผ่าน LIFF
	1.	ผู้ใช้ authenticated ผ่าน LIFF, สถานะ booking ต้องเป็น `confirmed`
	2.	ขอพิกัดจากเบราว์เซอร์ (Geolocation API)
	3.	ฝั่งเซิร์ฟเวอร์คำนวณระยะจากจุดจัดงาน (Haversine) ต้องไม่เกินรัศมีที่ตั้งค่า
	4.	ตรวจช่วงเวลาเปิดเช็คอิน (เช่น ก่อนเริ่มงาน 1 ชม. ถึงจบงาน)
	5.	ผ่านแล้ว: `checked_in` + `checkedInAt` + (แนะนำ) เก็บ `checkInLat`, `checkInLng` สำหรับ audit
	6.	ล้มเหลว: แจ้งข้อความชัดเจน + ชี้ไปยัง **แอดมินเช็คอิน** เป็น fallback

Checkout + จบกิจกรรม (ใช้งานในโค้ดปัจจุบัน)
	1.	อนุญาตเฉพาะเมื่อ `status === checked_in` และยังไม่มี `checkedOutAt`
	2.	ผู้ใช้กดเช็คเอาท์ในหน้า **`/liff/checkout`** → **`POST /api/bookings/self-checkout`** บันทึก **`checkedOutAt`**
	3.	ส่ง **Flex Message** สรุปค่ำคืน (ชื่อ, รหัสจอง, จำนวนแก้ว, ฉายา, เวลาเช็คเอาท์) ผ่าน `buildCheckoutCompleteFlexMessage` — รูป hero: `public/images/mascot-icon/cheackout-alexcraft.png` (URL เต็มประกอบจาก **`APP_BASE_URL`**)
	4.	**Rich Menu “Completed”:** ตอนนี้ `Booking.status` ยังคงเป็น **`checked_in`** หลังเช็คเอาท์ (ใช้ฟิลด์ **`checkedOutAt`** แยกว่าออกจากงานแล้ว) — `syncRichMenuByBookingStatus` **ยังไม่ถูกเรียก** หลัง checkout ดังนั้นเมนู LINE อาจยังเป็นเมนูหลังเช็คอินอยู่ จนกว่าจะเพิ่ม logic สลับเมนูตาม `checkedOutAt` หรือเพิ่มสถานะใน DB

เงื่อนไขจำเป็น ประกอบด้วย

1) จำกัดจำนวนที่นั่ง

จำนวนที่นั่งรวมของงาน (**capacity**) ควรกำหนดได้จาก **โซนตั้งค่าแอดมิน** (เดียวกับพิกัดงาน) เพื่อให้เพิ่ม/ลดได้ก่อนหรือระหว่างงานโดยไม่ต้อง deploy ใหม่; ค่าเริ่มต้นในโค้ด/ env (เช่น 40) ใช้เป็นค่าแรกหรือ fallback โดยยึดนโยบาย **1 LINE ID = 1 booking = 1 ที่นั่ง**

เวลา submit booking ต้องเช็กว่า
	•	จำนวนรายการที่ยืนยันแล้วรวมกับรายการใหม่ (คิด 1 ที่นั่งต่อ 1 booking)
	•	ต้องไม่เกิน **capacity ปัจจุบัน** ที่อ่านจาก DB (หรือจาก config ถ้ายังไม่ย้าย)

ตัวอย่าง logic:
	•	นับเฉพาะ booking ที่ status = CONFIRMED หรือ CHECKED_IN (แต่ละ booking นับเป็น 1 ที่)
	•	หรือจะรวม WAITING_REVIEW ด้วยก็ได้ ถ้าต้องการกันที่ไว้ก่อน

ข้อควรระวังเมื่อ **ลด capacity** หลังมีคนจองแล้ว:
	•	แสดงคำเตือนในแอดมินถ้ายอดรวม seats ที่ถืออยู่เกิน capacity ใหม่
	•	กำหนดนโยบาย: ห้ามลดจนกว่าจะยกเลิกบางรายการ, หรืออนุญาตแต่บล็อกการจองใหม่จนกว่าจะต่ำกว่าเพดาน

⸻

2) กันลงทะเบียนซ้ำ

แนะนำกันซ้ำแบบนี้ก่อน
	•	1 LINE user ลงได้ 1 booking
หรือ
	•	1 LINE user ลงได้หลาย booking (สำหรับเวอร์ชันอนาคตเท่านั้น)

สำหรับงานนี้กำหนดชัดเจน
	•	1 LINE user = 1 booking = 1 ที่นั่ง (fix)

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
	•	เริ่มใส่กติกาจำกัดที่นั่ง (capacity เริ่มต้นจาก config; เป้าหมายคือย้ายไป **ตั้งค่าแอดมิน** ตาม Step 12)

Phase 2: Payment Review + Approval Flow
เป้าหมาย: ทำ flow ชำระเงิน/ตรวจสอบ/อนุมัติให้ครบ
	•	แสดง **QR ชำระเงิน** (พร้อมเพย์หรือมาตรฐานที่เลือก) ให้สอดคล้องยอดจอง และออกแบบ flow คู่กับสลิป/provider (ถ้ามี)
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
	•	เพิ่ม LINE Login callback flow (`/liff/callback`) พร้อมตรวจ `state` + exchange `code` ฝั่ง server
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

Phase 6: Dynamic Rich Menu + Self Check-in (NEW-IDEA)
เป้าหมาย: เมนู LINE สะท้อนสถานะจริง และลดคิวหน้างานด้วยเช็คอินเอง
	•	ออกแบบ Rich Menu หลายชุดใน LINE OA Manager (default + ตาม state)
	•	เก็บ `richMenuId` ต่อ state ใน env/config
	•	หน้าแอดมิน **โซนตั้งค่างาน** กำหนด **capacity (จำนวนที่นั่งรวม)** + **พิกัดจัดงาน** + รัศมี/ช่วงเวลาเช็คอิน — บันทึกลง DB; การจองและ self-check-in อ่านจากตั้งค่านี้
	•	Implement `linkRichMenu` / `unlinkRichMenu` (Messaging API) และเรียกทุกครั้งที่สถานะ booking เปลี่ยน
	•	หน้า `/liff/checkin` + API ตรวจระยะ + ช่วงเวลา + idempotent เช่นเดียวกับ check-in แอดมิน
	•	ทดสอบความแม่นยำ GPS, กรณีปฏิเสธตำแหน่ง, และ fallback ไปแอดมิน

Phase 7: In-event Game + Checkout (ส่วนใหญ่ใช้งานแล้ว — ดู Step 13)
เป้าหมาย: engagement ระหว่างงานและจบ flow ชัดเจน
	•	Migration: ฟิลด์ **`drinkCount`**, **`drinkLastAt`**, **`checkedOutAt`** บน `Booking` (ไม่แยก `GameProfile` แยกตาราง)
	•	API **`GET/POST /api/liff/drink`**: cooldown, max ต่อคน, rate limit — milestone 3/6/10 แก้วส่ง Flex
	•	หน้า **`/liff/beer`** + **`/liff/energy`** (ฉายา/แก้ว)
	•	หน้า **`/liff/checkout`** + **`POST /api/bookings/self-checkout`** + Flex สรุป — **สลับ Rich Menu Completed อัตโนมัติ** ยังเป็นงานถัดไป (ดู Step 13)
	•	(ถ้าต้องการ) หน้าแอดมินดูสถิติ / force checkout

Phase 8: Polish สำหรับงานจริง (NEW-IDEA)
	•	ข้อความและ UX ไม่ส่งเสริมการดื่มหนัก; คำอธิบายสิทธิ์ตำแหน่ง (privacy)
	•	UAT: ทุก transition ของ Rich Menu + self check-in + game + checkout
	•	เอกสารหน้างานอัปเดต (ทั้งเช็คอินแอดมินและ self check-in)

⸻

Checklist การพัฒนา (เรียงตาม Step เดียวต่อเนื่อง)

ใช้ checkbox สะท้อนสถานะงานจริงของโปรเจกต์ (`[x]` ทำแล้ว, `[ ]` ยังไม่ทำ)

**ลำดับแนะนำ:** งานฐานข้อมูลใน **Step 2** (โดยเฉพาะ `EventSettings` และฟิลด์ที่เกี่ยวกับตั้งค่างาน / NEW-IDEA) ควรทำ **ก่อน** หน้า **`/admin/settings`** และ self check-in ใน **Step 12** — เพื่อให้ API และ UI อิงสคีมาที่นิ่งแล้ว

Step 1 — โครงสร้างโปรเจกต์และสภาพแวดล้อม
- [x] สร้าง Next.js + Tailwind + TypeScript project
- [x] ติดตั้ง Prisma และ migrate DB
- [x] ตั้งค่า `.env` สำหรับ LIFF, LINE Messaging API, Database (`.env.example`)
- [x] สร้าง `lib/prisma.ts` และ DB connection strategy
- [x] ตั้ง lint/format baseline (ESLint พร้อมใช้งาน)

Step 2 — ฐานข้อมูลและโดเมน
- [x] ออกแบบตาราง Booking (status, seats, bookingCode, checkedInAt, lineUserId)
- [x] ออกแบบตาราง AdminUser
- [x] ออกแบบตาราง CheckinLog / BookingStatusLog
- [x] ใส่ unique constraint: `lineUserId` (ช่วง MVP)
- [x] วาง index สำหรับ query ที่ใช้บ่อย (status, bookingCode, phone)
- [x] ตาราง **`EventSettings`** (แถวเดียวหรือรูปแบบที่เหมาะกับงาน): เก็บ **capacity**, **พิกัดจัดงาน** (lat/lng), **รัศมีเช็คอิน (m)**, **ช่วงเวลาเปิดเช็คอิน** (ตามที่ออกแบบ) — ทำ **schema + migration + seed** แล้ว และมี helper fallback จาก `config/event.ts`
- [x] ฟิลด์ **`checkedOutAt`** บน `Booking` + migration (ใช้แยก “ออกจากงานแล้ว” โดยไม่เปลี่ยน enum `BookingStatus`)
- [ ] (Optional) พิกัด/audit เชิงลึกสำหรับ self check-in เช่น `checkInLat`, `checkInLng` แยกตาราง — ยังไม่บังคับ
- [x] ฟิลด์เกมบน **`Booking`**: `drinkCount`, `drinkLastAt` (คู่กับ `EventSettings.drinkCooldownSec` / `drinkMaxPerUser`) + migration

Step 3 — ผู้ใช้ผ่าน LIFF (ลงทะเบียน / สถานะ / หน้าจอง)
- [x] ทำ LIFF bootstrap และตรวจสอบ login state
- [x] เพิ่ม route callback (`/liff/callback`) และ redirect flow กลับหน้าปลายทาง (รองรับ `liff.state`)
- [x] เพิ่ม server callback exchange (`GET /api/liff/login/callback`) สำหรับ flow `code/state` ของ LINE Login
- [x] เพิ่มปุ่ม `Login with LINE` ในหน้า `/liff/register` (เรียก `GET /api/liff/login/start?redirectTo=/liff/register` แล้ว redirect)
- [x] ทำฟอร์มลงทะเบียนพร้อม validation
- [x] อัปโหลดสลิปและบันทึก path/url
- [x] ทำหน้าตรวจสอบสถานะ (`/liff/status`)
- [x] ทำหน้ายืนยันการจอง (`/booking/[code]`)

Step 4 — การชำระเงิน (สลิป + QR Code)
- [x] Flow แนบสลิปและสถานะ `waiting_payment_review` / ตรวจสอบโดยแอดมิน
- [x] แสดง **QR ชำระเงิน** บนหน้าผู้ใช้ (ตอนนี้แสดงทั้งหลังลงทะเบียนสำเร็จที่ `/liff/register` และหน้า `/booking/[code]`)
- [x] สร้าง QR ให้สอดคล้องยอดที่ต้องชำระ (ราคาต่อคน × 1 ที่ต่อ booking ตามนโยบายปัจจุบัน) พร้อม `paymentRef` และเวลาหมดอายุ
- [x] ตัดสินใจ flow หลังสแกนจ่ายเป็น **manual slip-first**: ผู้ใช้ชำระผ่าน QR แล้วส่งลิงก์สลิปผ่าน `POST /api/bookings/code/[code]/submit-slip` จากหน้า `/booking/[code]` → ระบบปรับเป็น `waiting_payment_review`
- [x] เก็บ payment reference / เวลาหมดอายุของคำขอชำระ ใน DB (`paymentRef`, `paymentRequestedAt`, `paymentExpiresAt`)
- [ ] (ถ้ามี provider) กันชำระซ้ำซ้อน + เชื่อม webhook/provider อัตโนมัติตามนโยบาย

Step 4.1 — สเปกเทคนิคที่ใช้เริ่มพัฒนา (อัปเดตล่าสุด)
- [x] เพิ่มค่าคอนฟิกการชำระเงิน เช่น `PAYMENT_PER_PERSON_THB`, `PAYMENT_QR_TYPE`, `PAYMENT_QR_EXPIRY_MINUTES` ใน env และ `config/payment.ts`
- [x] เพิ่มฟิลด์ใน Booking สำหรับ `paymentAmount`, `paymentRef`, `paymentQrPayload`, `paymentQrImageUrl`, `paymentRequestedAt`, `paymentExpiresAt` + migration
- [x] กำหนดจุดสร้าง QR ตอนสร้าง booking (`POST /api/bookings`) และบันทึกข้อมูลลง DB
- [x] หน้า `/liff/register` และ `/booking/[code]` แสดงยอดชำระ + QR + reference เดียวกันกับใน DB
- [x] รองรับ re-generate QR จากหน้า `/booking/[code]` ผ่าน `POST /api/bookings/code/[code]/payment-qr`
- [x] เพิ่ม endpoint ส่งสลิปหลังชำระ `POST /api/bookings/code/[code]/submit-slip` และ UI ใน `/booking/[code]`

Step 5 — แอดมินจัดการจองและกฎธุรกิจ
- [x] Login หลังบ้าน
- [x] Booking list + filter + search
- [x] Booking detail + approve/cancel/mark paid
- [x] จำกัดจำนวนที่นั่งรวมไม่เกิน capacity (อ่านจาก config / logic ปัจจุบัน)
- [x] ปรับค่า capacity ได้จาก config (หรือ mechanism ที่มีอยู่ในโค้ดช่วง MVP)
- [x] หน้า **`/admin/settings`** + `GET/PATCH /api/admin/settings`: แก้ไข **จำนวนผู้เข้ารวมของงาน (capacity)** และค่าพื้นฐานอื่นๆ (พิกัด/รัศมี/เวลา/cooldown) ได้จากแอดมิน
- [x] กันลงทะเบียนซ้ำตาม LINE User ID
- [x] รองรับการเปลี่ยนสถานะตามลำดับที่ถูกต้องเท่านั้น

Step 6 — เช็คอินหน้างาน (แอดมิน)
- [x] Check-in หน้างาน (scan + search)
- [x] แสดงผลชัดเจนเมื่อเช็คอินซ้ำ
- [x] กันเช็คอินซ้ำ (idempotent check-in)

Step 7 — LINE Messaging API และ Webhook
- [x] สร้าง utility สำหรับ push message
- [x] ส่งข้อความเมื่อ approve/cancel/check-in (ถ้าต้องการ)
- [x] สร้างและทดสอบ webhook endpoint
- [x] จัดการ retry/timeout/error จาก LINE API

หมายเหตุ — Local HTTPS สำหรับทดสอบ LINE
- LINE LIFF และ LINE Webhook ต้องใช้ URL แบบ `https` เท่านั้น
- โปรเจกต์นี้ตั้งค่า tunnel หลักเป็น `ngrok` (โดย fallback เป็น cloudflared/localtunnel ได้)
  - รันแอป: `npm run dev`
  - เปิด tunnel https: `npm run tunnel` (เรียก `ngrok` ตรงจากเครื่อง)
  - หรือรันพร้อมกัน: `npm run dev:tunnel`
- (ถ้าต้องการ fallback) ใช้ `npm run tunnel:cf` หรือ `npm run tunnel:lt`
- เอา URL ที่ได้จาก tunnel ไปตั้งค่าใน LINE Developer Console:
  - LIFF URL: `<https-url>/liff/register`
  - Login Callback URL: `<https-url>/liff/callback`
  - Webhook URL: `<https-url>/api/webhook/line`
- สำหรับ LINE Login (ถ้าเปิดใช้):
  - ตั้งค่า env เพิ่ม: `LINE_LOGIN_CHANNEL_ID`, `LINE_LOGIN_CHANNEL_SECRET`
  - เริ่ม login URL จาก `GET /api/liff/login/start?redirectTo=/liff/register`
- ใช้ endpoint นี้สำหรับรับ event:
  - `POST /api/webhook/line`
- จุดที่เชื่อมต่อ LINE จริงในโค้ด:
  - `src/lib/line.ts` (push + retry + signature verify)
  - `src/app/api/bookings/[id]/approve/route.ts` (notify approve)
  - `src/app/api/bookings/[id]/cancel/route.ts` (notify cancel)
  - `src/app/api/bookings/checkin/route.ts` (notify check-in ด้วย **Flex Message**)
  - `src/app/api/bookings/self-checkin/route.ts` (เช็คอินด้วยตนเอง + **Flex Message** เมื่อสำเร็จ)
  - `src/app/api/bookings/self-checkout/route.ts` (เช็คเอาท์จาก LIFF + **Flex Message** สรุปค่ำคืน)

---

## Self check-in (LIFF) — เวลา รัศมี และข้อความตอบกลับ

หน้า **`/liff/checkin`** เรียก **`POST /api/bookings/self-checkin`** พร้อม `lineUserId` + พิกัดจาก Geolocation ระบบอ่าน **`EventSettings`** (พิกัดจุดจัดงาน, `checkinRadiusM`, `checkinStartAt`, `checkinEndAt`) แล้วตัดสินตามลำดับนี้:

1. **ยังไม่ถึงเวลาเปิดเช็คอิน** (`now < checkinStartAt` เมื่อมีตั้งค่าไว้)  
   - HTTP `400`, `code`: `CHECKIN_NOT_OPEN`  
   - `message` ภาษาไทย พร้อมวันเวลาเปิด (`checkinOpensAtFormattedTh`) และนับถอยหลังโดยประมาณ (`remaining`: วัน / ชั่วโมง / นาที)  
   - หน้า LIFF แสดงข้อความหลัก + บรรทัดเสริม “เปิดเช็คอิน: …”

2. **เลยช่วงเช็คอินแล้ว** (`now > checkinEndAt` เมื่อมีตั้งค่าไว้)  
   - HTTP `400`, `code`: `CHECKIN_CLOSED`  
   - แนะนำให้ติดต่อทีมงานหน้างาน

3. **อยู่ในช่วงเวลา แต่นอกรัศมี** (Haversine เกิน `checkinRadiusM`)  
   - HTTP `400`, `code`: `OUTSIDE_CHECKIN_AREA`  
   - `message` ภาษาไทย + `distanceMeters` / `radiusMeters`  
   - หน้า LIFF แสดงระยะเพิ่มใต้ข้อความแดง

4. **ผ่านทั้งเวลาและรัศมี**  
   - อัปเดตสถานะเป็น `checked_in`, บันทึก log  
   - ส่ง **Flex Message** ไป LINE (`buildCheckinConfirmedFlexMessage` ใน `src/lib/line-flex-checkin-confirmed.ts`) และสลับ Rich Menu  
   - HTTP `200`, `code`: `SUCCESS`

**แอดมินเช็คอิน** (`POST /api/bookings/checkin`) ไม่ตรวจเวลา/GPS — เมื่อสำเร็จจะส่ง Flex เช็คอินแบบเดียวกับ self check-in

ข้อความวันที่/เวลางานใน Flex เช็คอิน ใช้ชุดเดียวกับ Flex อนุมัติการจอง: แก้ที่ **`src/config/line-registration-flex.ts`**

---

## Self checkout (LIFF) — เช็คเอาท์และ Flex สรุป

หน้า **`/liff/checkout`** เรียก **`POST /api/bookings/self-checkout`** พร้อม `lineUserId` (จาก session/cache เดียวกับหน้า LIFF อื่น)

1. **ไม่ได้เช็คอิน** (`status !== checked_in`) → HTTP `400`, `code`: `NOT_CHECKED_IN`
2. **เช็คเอาท์ซ้ำ** (`checkedOutAt` มีแล้ว) → HTTP `200`, `code`: `ALREADY_CHECKED_OUT`
3. **สำเร็จ** → ตั้ง **`checkedOutAt`** แล้วส่ง Flex **`buildCheckoutCompleteFlexMessage`** (`src/lib/line-flex-checkout-complete.ts`) — รูป hero ใช้ **`APP_BASE_URL` + `/images/mascot-icon/cheackout-alexcraft.png`**

หมายเหตุ: การสลับ Rich Menu เป็น **Completed** ยังไม่ผูกกับ endpoint นี้โดยอัตโนมัติ (ดูหัวข้อ “Checkout + จบกิจกรรม” ด้านบน)

---

คู่มือเครื่องมือสำหรับนักพัฒนา (Developer Tools Guide)

## Rich Menu — สร้าง / ลิงก์ / ตรวจสอบ

Rich Menu ของ LINE มี 2 ชั้น:
- **Default Rich Menu** — ตั้งผ่าน LINE OA Manager; ทุกคนที่ยังไม่ถูก link per-user จะเห็นเมนูนี้
- **Per-user Rich Menu** — ตั้งผ่าน Messaging API; priority สูงกว่า default (ใช้เมนูเฉพาะสถานะ เช่น Pending / Confirmed / Checked-in)

### 1) สร้าง Rich Menu (Messaging API)

**สำคัญ — Rich Menu กดแล้วทำอะไรได้บ้าง**

- ปุ่ม Rich Menu ใช้แอคชัน **`uri`** เท่านั้น → เปิดลิงก์ในเบราว์เซอร์ / เปิด **LIFF** ตาม URL ที่ผูกไว้ตอนสร้างเมนู
- **ไม่สามารถ** ให้ LINE ส่ง Flex หรือข้อความทันทีที่ “แตะเมนู” ได้โดยตรง — Flex หลังเช็คอินสำเร็จถูกส่งจาก **`POST /api/bookings/self-checkin`** หลังผู้ใช้กดเช็คอินในหน้า LIFF แล้วเท่านั้น
- ถ้า `RICH_MENU_ID_CONFIRMED` ชี้ปุ่มซ้ายไป **`/liff/register`** ผู้ใช้ที่อนุมัติแล้วจะไปหน้าลงทะเบียนซ้ำ — ปุ่ม “เช็คอิน / เข้างาน” ต้องชี้ไป **`https://liff.line.me/<LIFF_ID>/liff/checkin`** (หรือ endpoint ของคุณที่เปิดหน้า check-in)

**LIFF Endpoint ใน LINE Developers Console**

- แนะนำให้ Endpoint URL เป็น **origin ของแอป** (เช่น `https://your-ngrok.ngrok-free.app`) เพื่อให้ path ต่อท้าย `https://liff.line.me/<LIFF_ID>/liff/checkin` ไปที่ `/liff/checkin` ได้
- ถ้า Endpoint เป็นแค่ `.../liff/register` อย่างเดียว การเปิด path อื่นอาจผิดพลาด — ควรปรับเป็น root ของโดเมนเดียวกับแอป

**Preset (แนะนำ)** — ใช้ `LIFF_ID` จาก `.env` สร้าง URL ซ้าย/ขวาให้ถูกต้อง:

```bash
npm run line:richmenu:create:pending
npm run line:richmenu:create:confirmed
npm run line:richmenu:create:checked-in
```

หรือระบุเอง:

```bash
npm run line:richmenu:create -- \
  --name pending-alexcraft \
  --left "https://liff.line.me/<LIFF_ID>" \
  --right "https://maps.google.com/?q=..." \
  --image public/images/richmenu/register-status-alexcraft.png
```

| Flag | คำอธิบาย |
|------|----------|
| `--name` | ชื่อเมนู (ตั้งอะไรก็ได้ เห็นเฉพาะแอดมิน) |
| `--left` | URI ปุ่มซ้าย (เช่น LIFF หน้าสถานะ) |
| `--right` | URI ปุ่มขวา (เช่น ลิงก์ Google Maps) |
| `--image` | ไฟล์ PNG/JPEG (รองรับ 1200×405 หรือ 2500×843) |
| `--chat-bar` | ข้อความปุ่มด้านล่างแชท (default: "เมนู") |
| `--preset` | `pending` \| `confirmed` \| `checked_in` — ตั้ง `--left` / `--right` / `--image` ให้ตาม flow (ต้องมี `LIFF_ID`) |

สคริปต์จะ:
1. สร้าง Rich Menu → ได้ `richMenuId`
2. อัปโหลดรูปภาพ
3. แสดง richMenuId ให้คัดลอกไปใส่ `.env`

ตัวอย่าง output:
```
richMenuId: richmenu-a24f681f6ac5664cc9f2d6aebcf240f9

Add to .env (example):
RICH_MENU_ID_PENDING="richmenu-a24f681f6ac5664cc9f2d6aebcf240f9"
```

ถ้าไม่อยากใส่ flag ทุกครั้ง ตั้ง env ใน `.env` ได้:
```
RICH_MENU_CREATE_NAME="pending-alexcraft"
RICH_MENU_CREATE_LEFT_URI="https://liff.line.me/..."
RICH_MENU_CREATE_RIGHT_URI="https://maps.google.com/?q=..."
RICH_MENU_CREATE_IMAGE="public/images/richmenu/register-status-alexcraft.png"
```

### 2) ลิงก์ Rich Menu ให้ user (ทดสอบ / แก้ไขกรณีเมนูค้าง)

```bash
npm run line:richmenu:link -- <lineUserId> [richMenuId]
```

- `lineUserId` — ค่า **U + 32 ตัวอักษร hex ของบัญชี LINE จริง** (ดูจาก webhook / หน้า admin เมื่อมีจอง / หรือ log ฝั่งเซิร์ฟเวอร์) — **ห้ามใช้ตัวอย่าง** `U1234567890abcdef1234567890abcdef` ใน docs เพราะไม่ใช่ user ของคุณ คำสั่งจะไม่กระทบเมนูในมือถือคุณ
- `richMenuId` — ถ้าใส่เป็นค่า `richmenu-...` จะลิงก์เมนูนั้นโดยตรง
- ถ้าไม่ใส่ `richMenuId` — สคริปต์จะใช้ **`RICH_MENU_ID_PENDING`** จาก `.env` (เหมาะกับทดสอบเมนู pending เท่านั้น)  
  ถ้าอยากลิงก์เมนู **confirmed** ให้ใส่ flag ชัดเช่น `--confirmed`

ตัวอย่าง:
```bash
npm run line:richmenu:link -- U1234567890abcdef1234567890abcdef richmenu-a24f681f6ac5664cc9f2d6aebcf240f9
npm run line:richmenu:link -- U1234567890abcdef1234567890abcdef --confirmed
npm run line:richmenu:link -- U1234567890abcdef1234567890abcdef --guest
npm run line:richmenu:link -- U<lineUserIdจริง32hex> --unlink
npm run line:richmenu:link -- U<lineUserIdจริง32hex> --show
```

- **`--show`** — เรียก `GET .../user/{userId}/richmenu` แสดงว่า user นี้ถูกผูก **richMenuId** อะไรอยู่ (หรือ 404 = ไม่มีเมนู per-user แล้ว ใช้ default OA)
- **`--unlink`** — ถอดเมนู per-user ออกจาก LINE user นั้น → แชทจะกลับไปใช้ **default rich menu** ใน OA Manager (เหมาะหลังลบข้อมูลใน DB แต่เมนยังค้างเป็น checked-in)
- **`--guest`** — ลิงก์เมนูจาก `RICH_MENU_ID_GUEST` (ต้องตั้งใน `.env` และสร้างเมนู guest ผ่าน API ไว้แล้ว)

Flag ที่รองรับ: `--show`, `--guest`, `--pending` (default เมื่อไม่ใส่ id), `--confirmed`, `--checked-in`, `--cancelled`, `--waiting-payment`, `--unlink`

### 3) ตั้งค่า env สำหรับ Rich Menu แต่ละสถานะ

`.env` (หรือ `.env.example`):
```
RICH_MENU_ID_GUEST=""
RICH_MENU_ID_PENDING="richmenu-..."
RICH_MENU_ID_WAITING_PAYMENT=""
RICH_MENU_ID_CONFIRMED=""
RICH_MENU_ID_CHECKED_IN=""
RICH_MENU_ID_COMPLETED=""
RICH_MENU_ID_CANCELLED=""
```

เมื่อสถานะ booking เปลี่ยน (register, submit-slip, approve, cancel, check-in) ระบบจะเรียก `syncRichMenuByBookingStatus` → link เมนูที่ตรงกับสถานะให้อัตโนมัติ ถ้า env ไม่มี id สำหรับสถานะนั้น จะ skip และ log ใน audit

### 4) สลับ Rich Menu อัตโนมัติเกิดที่ไหนบ้าง

| เหตุการณ์ | ไฟล์ | สถานะปลายทาง |
|-----------|------|-------------|
| ลงทะเบียนสำเร็จ | `POST /api/bookings` | pending |
| ส่งสลิป | `POST /api/bookings/code/[code]/submit-slip` | waiting_payment_review |
| Admin mark paid | `POST /api/bookings/[id]/mark-paid` | waiting_payment_review |
| Admin อนุมัติ | `POST /api/bookings/[id]/approve` | confirmed |
| Admin ยกเลิก | `POST /api/bookings/[id]/cancel` | cancelled |
| Admin ปฏิเสธสลิป | `POST /api/bookings/[id]/reject-slip` | pending |
| Admin check-in | `POST /api/bookings/checkin` | checked_in |
| Self check-in | `POST /api/bookings/self-checkin` | checked_in |

### Rich Menu หลังเช็คอิน (`checked_in`) — สามโซนบนรูปเดียว

**ความตั้งใจ (ผลิตภัณฑ์):** หลังผู้ใช้ `checked_in` แล้ว เมนูนี้ใช้สำหรับ **กิจกรรมในงาน** — โซนซ้ายคือ **เติมแก้ว (+1 แก้ว / cooldown / เพดาน)** ไม่ใช่หน้าแสดงว่า “เช็คอินแล้ว” (สถานะการจองอยู่ที่ **`/liff/status`** หรือข้อความ Flex หลังเช็คอิน)

**ชื่อ path ในโค้ด:** โซนซ้ายชี้ไป **`/liff/beer`** — หน้านี้เรียก **`GET/POST /api/liff/drink`** อัปเดต `drinkCount` / `drinkLastAt` ตาม `EventSettings`

รูป **`public/images/richmenu/energy-status-alexcraft.png`** (1200×405) — สคริปต์สร้างเมนูแบ่ง **3 โซนเท่ากันในระนาบ x** (400px ต่อโซน) ตาม `scripts/line/create-richmenu.mjs` (`layout1200x405Three`):

| พิกัดแตะ (x) | ป้ายใน API | ปลายทาง (หลังเปิด LIFF) | หมายเหตุ |
|--------------|------------|-------------------------|----------|
| 0–399 (ซ้ายสุด) | เติมเบียร์ | `/liff/beer` | เติมแก้ว + cooldown + เพดาน (`/api/liff/drink`) |
| 400–799 (กลาง) | ระดับพลัง | `/liff/energy` | แก้ว + ฉายา (`GET /api/liff/drink`) |
| 800–1199 (ขวา) | Check out | `/liff/checkout` | เช็คเอาท์ + Flex สรุป (`POST /api/bookings/self-checkout`) |

**LIFF Endpoint URL (สำคัญ):** สคริปต์ preset (`pending` / `confirmed` / `checked_in`) สร้างลิงก์แบบ  
`https://liff.line.me/<LIFF_ID>?p=/liff/beer` (และ path อื่นใน `p`) เพื่อให้ LINE โหลด **`{APP_BASE_URL}/liff?p=...`** แล้วแอปจะ **redirect ไป `/liff/beer` ฯลฯ** (`src/app/liff/page.tsx`)  
- ตั้ง **LIFF Endpoint URL** ใน LINE Developers เป็น **`{APP_BASE_URL}/liff`** (ท้าย path เป็น `/liff` — **ลบ `/register` ออก** จากเดิม `.../liff/register` ได้)  
- เปิด LIFF แบบ `https://liff.line.me/<LIFF_ID>` **ไม่มี** `?p=` แอปจะส่งต่อไป **`/liff/register`** — ลงทะเบียนจองสิทธิ์รอบแรกยังใช้ได้เหมือนเดิม  
- ถ้า Endpoint ตั้งเป็นหน้าเดียว มักเกิดอาการ **ทุกโซน Rich Menu ไปหน้าเดิม** หรือไม่ตรงกับชื่อปุ่ม — แก้ที่คอนโซ LINE แล้ว **สร้าง Rich Menu ใหม่ + link ใหม่**

**ถ้ากด “เติมเบียร์” แล้วรู้สึกว่าไปโผล่เรื่อง “เช็คอินแล้ว” — สาเหตุที่เป็นไปได้**

1. **LINE ยังลิงก์เมนู `confirmed` อยู่** — ใน preset `confirmed` โซนซ้ายชี้ไป **`/liff/checkin`** ไม่ใช่ `/liff/beer` ผู้ที่เช็คอินแล้วจะเห็นข้อความซ้ำว่าเช็คอินแล้วบนหน้า check-in ได้  
   → ตรวจว่า `RICH_MENU_ID_CHECKED_IN` ตั้งใน `.env` แล้ว และหลัง self check-in / approve มี log ว่า sync เมนูสำเร็จ (`syncRichMenuByBookingStatus`) หรือลิงก์ด้วย `npm run line:richmenu:link -- <lineUserId> --checked-in`
2. **LIFF Endpoint ไม่ใช่ `/liff`** — ทุกโซนอาจเปิดหน้าเดิมหรือไม่ตรงปุ่ม (ดูย่อหน้าก่อนหน้า)
3. **รูปกับลำดับ URI ไม่ตรงกัน** — บนรูปถ้าปุ่ม “เติมเบียร์” อยู่ **กลางหรือขวา** แต่ยังใช้ preset เดิม จะได้ URL ของโซนกลาง/ขวาแทน → ต้องสลับ `--left` / `--mid` / `--right` ให้ตรงกับภาพ หรือปรับ artwork ให้ปุ่มซ้ายสุดตรงกับ bounds ซ้ายจริง
4. **จากหน้า `/liff/beer` กด “กลับไปดูสถานะ”** — ลิงก์ไป **`/liff/energy`** (หน้าระดับพลัง/ฉายา) ไม่ใช่ `/liff/status` — หน้า **`/liff/energy`** มีปุ่มไป **`/liff/beer`** สำหรับเติมแก้ว

สร้างเมนู (ต้องมี `LINE_CHANNEL_ACCESS_TOKEN` + `LIFF_ID` ใน `.env`):

```bash
npm run line:richmenu:create -- --preset checked_in
```

ได้ `richMenuId` แล้วใส่ `RICH_MENU_ID_CHECKED_IN` ใน `.env` — เมื่อสถานะเป็น `checked_in` ระบบจะ `linkRichMenuIdToUser` อัตโนมัติ

ถ้าต้องการกำหนด URL เอง (รูปอื่นขนาด 1200×405):

```bash
npm run line:richmenu:create -- \\
  --left "https://liff.line.me/<LIFF_ID>?p=%2Fliff%2Fbeer" \\
  --mid "https://liff.line.me/<LIFF_ID>?p=%2Fliff%2Fenergy" \\
  --right "https://liff.line.me/<LIFF_ID>?p=%2Fliff%2Fcheckout" \\
  --image public/images/richmenu/energy-status-alexcraft.png \\
  --name alexcraft-checked-in-energy
```

(หรือใช้ path แบบ `.../liff/beer` ได้ถ้า LIFF Endpoint เป็น root และ LINE ส่ง path ครบ — แนะนำให้สอดคล้องกับ preset ที่ใช้ `?p=`)

---

## Flex Message — ดูตัวอย่าง / ทดสอบ

เมื่อแอดมินกดอนุมัติ (approve) ระบบจะส่ง **Flex Message** ไป LINE ของผู้ใช้ (แทนข้อความธรรมดา) พร้อม QR สำรองสำหรับเช็คอิน

### วิธี 1: ดู JSON ใน LINE Flex Message Simulator (ไม่ส่งจริง)

**กรณี Flex ที่ผูกกับ booking (อนุมัติ / เช็คอิน)**

1. เปิด browser ไปที่:
   ```
   http://localhost:3000/api/admin/preview-flex?bookingId=<BOOKING_ID>[&kind=registration|checkin]
   ```
   ใช้ **`bookingId`** เป็น cuid จากหน้า admin หรือใส่ **`bookingCode`** (เช่น `BK-XXXX`) แทน query เดียวกันได้ — พารามิเตอร์ **`kind`** ค่าเริ่มต้นคือ `registration`; ใส่ `checkin` เพื่อดู Flex หลังเช็คอิน

**กรณี Flex milestone แก้ว (ไม่ต้องมี booking)**

```
http://localhost:3000/api/admin/preview-flex?kind=drink_milestone&level=1[&drinkCount=3]
```

- **`level`**: `1` | `2` | `3` (สอดคล้อง milestone ที่ 3 / 6 / 10 แก้ว — ถ้าไม่ส่ง `drinkCount` จะใช้ค่า default ตามระดับ)

2. ใน JSON ที่ได้ (ทั้งกรณี booking หรือ milestone) ให้คัดลอกส่วน **`contentsOnly`**
3. เปิด [LINE Flex Message Simulator](https://developers.line.biz/flex-simulator/)
4. กด **New** → วาง JSON → ดู preview ทันที

**หมายเหตุ:** ยังไม่มี **`preview-flex`** แยกสำหรับ Flex เช็คเอาท์ — ดูโครงสร้างที่ **`src/lib/line-flex-checkout-complete.ts`** หรือทดสอบด้วยการเช็คเอาท์จริงในหน้า **`/liff/checkout`**

**`bookingId`** หาได้จาก:
- หน้า admin กด **Detail** → URL จะเป็น `/admin/bookings/<bookingId>`
- หรือดูจาก DB โดยตรง

### วิธี 2: ส่ง Flex จริงไป LINE แต่ไม่เปลี่ยนสถานะ

```bash
curl -X POST http://localhost:3000/api/admin/test-flex \
  -H "Content-Type: application/json" \
  -d '{"bookingId":"<BOOKING_ID_OR_BK_CODE>"}'
```

ตัวอย่างใช้ **รหัสจอง** (สะดวกเมื่อไม่มี cuid ตรงหน้า):

```bash
curl -X POST "https://<APP_BASE_URL>/api/admin/test-flex" \
  -H "Content-Type: application/json" \
  -d '{"bookingId":"BK-XXXXXX"}'
```

ข้อความ Flex จะไปโผล่ในแชท LINE ของ user จริงๆ — **สถานะ booking ยังเป็นเดิม** ไม่ต้องรีเซ็ต ไม่ต้องยกเลิกแล้วลงทะเบียนใหม่ — ใช้ตรวจ layout/ข้อความหลังแก้ `line-registration-flex` หรือ `line-flex-registration-confirmed.ts`

### วิธี 3: กด approve จริง (เปลี่ยนสถานะ)

กดปุ่ม ✓ ในหน้า `/admin/bookings` → สถานะเปลี่ยนเป็น confirmed + ส่ง Flex + สลับ Rich Menu

### แก้ไขข้อความ / ข้อมูลงาน

ข้อมูลงาน (ชื่อ, วันที่, เวลา, สิทธิ์) ตั้งที่เดียว:
- **`src/config/line-registration-flex.ts`**

สี / layout ของ Flex:
- **`src/lib/line-flex-registration-confirmed.ts`** (อนุมัติการจอง)

Flex หลัง **เช็คอินสำเร็จ** (self + แอดมิน):
- **`src/lib/line-flex-checkin-confirmed.ts`**

Flex **milestone แก้ว** (ครั้งแรกที่ถึง 3 / 6 / 10 แก้ว หลัง `POST /api/liff/drink`):
- **`src/lib/line-flex-drink-milestone.ts`** — hero ห่อด้วย `box` + `paddingAll` เล็กน้อยเพื่อให้รูปไม่ชิดขอบ; ข้อความใน body จัด **`align: center`**

Flex หลัง **เช็คเอาท์** (`POST /api/bookings/self-checkout`):
- **`src/lib/line-flex-checkout-complete.ts`** — รูป hero `public/images/mascot-icon/cheackout-alexcraft.png`

---

Step 8 — Security และคุณภาพโค้ด
- [x] ตรวจสอบ input และ sanitize ข้อมูล
- [x] ป้องกันการเข้าถึงหน้า admin โดยไม่ได้รับอนุญาต
- [x] เพิ่ม rate limit สำหรับ API สำคัญ
- [x] เพิ่ม log สำหรับ action สำคัญ (approve/check-in/cancel)
- [x] เขียน unit/integration test สำหรับ booking + check-in logic

Step 9 — UI / UX หลัก
- [x] ปรับ theme / spacing / typography ให้สอดคล้องทั้งระบบ
- [x] ตรวจสอบ responsive บน mobile/tablet/desktop
- [x] ทำ loading / empty / error states ให้ครบทุกหน้าหลัก

Step 10 — เกตทดสอบก่อนขยายฟีเจอร์ (Smoke + Regression)
- [x] ผู้ใช้ลงทะเบียนผ่าน `/liff/register` ได้และเห็นข้อความสำเร็จ
- [x] แอดมินเปลี่ยนสถานะจาก `/admin/bookings` (mark paid / approve / cancel) ได้
- [x] ผู้ใช้เปิด `/booking/[code]` และเห็นสถานะภาษาไทยถูกต้อง
- [x] แอดมินเช็คอินจาก `/admin/checkin` และกันเช็คอินซ้ำได้
- [x] `npm run lint` ผ่าน
- [x] `npm run test` ผ่าน
- [x] `npm run build` ผ่าน
- [x] สีธีมหลักตรงกัน (ดำ/ส้ม) ในหน้า user และ admin
- [x] เมนู sidebar แสดง active/hover เป็นสีส้มตาม route

Step 11 — พร้อมขึ้นโปรดักชัน (Go-live)
- [ ] เตรียม staging environment
- [ ] ทดสอบ end-to-end ตาม flow จริง
- [ ] ทำคู่มือหน้างานสำหรับทีม check-in
- [ ] เตรียม monitoring + alert เบื้องต้น
- [ ] สรุป runbook กรณีระบบล่ม/เชื่อม LINE ไม่ได้

Step 12 — โซนตั้งค่างานในแอดมิน + Dynamic UX + Self check-in (`docs/NEW-IDEA.md`)
- [x] หน้า **`/admin/settings`** — **โซนตั้งค่างาน** รวมในเดียวกัน (อิงสคีมา **`EventSettings` จาก Step 2**):
	- **จำนวนผู้เข้ารวม (capacity)** — เพิ่ม/ลดได้; ผูกกับการตรวจตอนสร้างจองและตอนอนุมัติ โดยยึด 1 booking = 1 ที่นั่ง
	- **พิกัดจัดงาน** (ละติจูด / ลองจิจูด) และค่าที่เกี่ยวข้องกับเช็คอิน เช่น **รัศมี (เมตร)** และ **ช่วงเวลาเปิดเช็คอิน**
- [x] API **`GET /api/admin/settings`** (โหลดฟอร์ม) และ **`PATCH /api/admin/settings`** (บันทึก) — อ่าน/เขียนแถว `EventSettings`; API จองอ่านจาก DB แล้ว
- [x] แสดงตัวอย่างพิกัด / ลิงก์เปิดแผนที่ (optional) เพื่อลดพิมพ์ผิด
- [ ] ออกแบบและสร้าง Rich Menu ชุดละ state (Guest/Pending/Confirmed/Checked-in/Completed) + default ใน OA Manager
- [x] เพิ่ม env/config สำหรับ `RICH_MENU_ID_*` หรือแผนที่ state → menu id (`.env.example` เพิ่มครบ guest/pending/confirmed/checked_in/completed/cancelled)
- [x] Implement บริการ LINE rich menu sync ตาม `lineUserId` เมื่อสถานะเปลี่ยนใน flow หลัก (register, submit-slip/mark-paid, approve, cancel, check-in, self-checkin)
- [ ] `config/event.ts` (หรือเทียบเท่า): ค่า default สำหรับ `CAPACITY`, `CHECKIN_RADIUS_M`, `CHECKIN_WINDOW`, `DRINK_COOLDOWN_SEC`, `DRINK_MAX_PER_USER` เมื่อ DB ยังไม่ตั้ง (สอดคล้อง seed ใน Step 2)
- [x] หน้า `/liff/checkin` + `POST /api/bookings/self-checkin`: Haversine ใช้พิกัดจาก **`EventSettings`** + เวลา + idempotent
- [x] ครอบคลุม edge cases หลักใน API: ปฏิเสธ location/ส่งพิกัดไม่ครบ, นอกรัศมี, ก่อน/หลังช่วงเวลา, status ไม่ถูกต้อง, rate limit
- [x] ข้อความตอบกลับ self check-in เป็นภาษาไทย + นับถอยหลังจนถึงเวลาเปิดเช็คอิน (`CHECKIN_NOT_OPEN`) และแจ้งนอกรัศมี (`OUTSIDE_CHECKIN_AREA`); เมื่อสำเร็จส่ง **Flex** แทนข้อความธรรมดา
- [ ] อัปเดต `/liff/status` และ `/booking/[code]` ให้สอดคล้องสถานะใหม่ (ถ้ามี checked_out/completed)

Step 13 — กิจกรรมในงาน + Checkout
- [x] หน้า **`/liff/beer`**, **`/liff/energy`**, **`/liff/checkout`** — ลิงก์จาก Rich Menu หลังเช็คอินแล้ว (ไม่ 404)
  - **หมายเหตุ:** โซน “เติมเบียร์” บนเมนู `checked_in` คือ **จุดเติมแก้ว** — ถ้าผู้ใช้เห็นข้อความ “เช็คอินแล้ว” ผิดที่ ให้ดูหัวข้อ troubleshooting ใน README หัวข้อ **Rich Menu หลังเช็คอิน**
- [x] หน้า `/liff/beer` + **API เติมแก้ว** (`GET/POST /api/liff/drink`): อ่าน `drinkCooldownSec` / `drinkMaxPerUser` จาก `EventSettings`; อัปเดต `Booking.drinkCount` + `drinkLastAt`; กันเกินเพดานและคูลดาวน์แบบอะตอมิก (`updateMany`) + `auditLog`
- [x] **Milestone แก้ว → Flex ใน LINE:** เมื่อ `drinkCount` ถึง **3 / 6 / 10** แก้ว (ครั้งแรกของแต่ละจุด) หลัง `POST /api/liff/drink` สำเร็จ ระบบ `push` Flex (bubble mega + hero รูปมาสคอต) — รูป `public/images/mascot-icon/FirstPour-alexcraft.png`, `BuzzRider-alexcraft.png`, `MidnightMaster-alexcraft.png`; hero URL ประกอบจาก **`APP_BASE_URL`** — โค้ด: `src/lib/line-flex-drink-milestone.ts` (ปรับ margin รอบ hero + จัดข้อความกลาง)
- [x] หน้า `/liff/energy` — แสดง **จำนวนแก้ว** + **ฉายา** ตามเกณฑ์ (&lt;3 สายปรับตัว · ≥3 สายอุ่นเครื่อง · ≥6 สายติดลม · ≥10 ตัวตึงแห่งค่ำคืน); ดึงจาก `GET /api/liff/drink` (`src/lib/drink-nickname.ts`); ปุ่มไป `/liff/beer` ใช้ลิงก์ `<a href>` เพื่อให้ทำงานใน LIFF
- [x] หน้า `/liff/checkout` + **`POST /api/bookings/self-checkout`**: บันทึก **`checkedOutAt`**, ส่ง Flex สรุป (`src/lib/line-flex-checkout-complete.ts`, รูป `cheackout-alexcraft.png`)
- [ ] สลับ Rich Menu เป็น **Completed** อัตโนมัติหลังเช็คเอาท์ (ตอนนี้ `Booking.status` ยังเป็น `checked_in` — ดูหมายเหตุที่หัวข้อ “Checkout + จบกิจกรรม” และ “Self checkout”)
- [ ] (Optional) แอดมิน: ดูสถิติเกม / บังคับ checkout

Step 14 — เกตทดสอบหลังขยายฟีเจอร์ (Rich Menu / Self check-in / เกม)
- [ ] ผู้ใช้ใหม่เห็น Rich Menu Guest → ลงทะเบียน → เมนูเปลี่ยนเป็น Pending
- [ ] อนุมัติ → เมนู Confirmed + เปิด LIFF check-in ได้
- [ ] แอดมินแก้ capacity / พิกัด / รัศมี / ช่วงเวลา → การจองและ self check-in ทำงานตามค่าใหม่ (ทดสอบกรณีลด capacity ด้วย)
- [ ] Self check-in ในรัศมีและช่วงเวลา → `checked_in` + เมนู Checked-in
- [ ] เติมแก้วตามกติกา → ตัวเลข/เลเวลถูกต้อง, เกิน cooldown/max ถูกบล็อก
- [ ] Checkout → สรุปผล + เมนู Completed
- [ ] Fallback: แอดมินเช็คอินได้เมื่อผู้ใช้ทำ self check-in ไม่สำเร็จ
- [ ] (หลังทำ Step 4 QR) ทดสอบ flow ชำระผ่าน QR + สลิป/provider ตามที่ออกแบบ