-- ใช้คำนวณ cooldown ระหว่างการกดเติมแก้ว (+1)
ALTER TABLE "Booking" ADD COLUMN "drinkLastAt" TIMESTAMP(3);
