# SỔ TAY VẬN HÀNH HỆ THỐNG GIÁM SÁT & NHẮC NHỞ PHẢN HỒI BÁN HÀNG (SALES SLA REMINDER)

> **Dành cho:** Ban Giám Đốc, Trưởng Phòng Bán Hàng, Quản Lý Đội Ngũ (Team Lead) và toàn thể Nhân Viên Kinh Doanh / Chăm Sóc Khách Hàng (Sellers / Sales).
> 
> **Mục tiêu sổ tay:** Giải thích rõ ràng, đơn giản, thực tế về cách hệ thống hoạt động: từ khung giờ làm việc, giờ nghỉ ngơi, cách tính thời gian phản hồi (KPI), các tình huống nhắn tin trong nhóm cho đến hiện trạng kết nối các kênh (Telegram, WhatsApp, Lark, Zalo, Facebook). **Không dùng thuật ngữ kỹ thuật khó hiểu, ai đọc cũng hiểu ngay quyền lợi và cách làm việc!**

---

## 📑 MỤC LỤC SỔ TAY

1. [Mục Đích & Ý Nghĩa Của Hệ Thống Đối Với Seller](#1-mục-đích--ý-nghĩa-của-hệ-thống-đối-với-seller)
2. [Khung Giờ Làm Việc, Giờ Nghỉ & Quyền Lợi Của Seller](#2-khung-giờ-làm-việc-giờ-nghỉ--quyền-lợi-của-seller)
3. [Cách Hệ Thống Đo Thời Gian & Nhắc Nhở (SLA Là Gì?)](#3-cách-hệ-thống-đo-thời-gian--nhắc-nhở-sla-là-gì)
4. [3 Bí Kíp Vàng Giúp Seller Luôn Đạt 100% KPI Phản Hồi](#4-3-bí-kíp-vàng-giúp-seller-luôn-đạt-100-kpi-phản-hồi)
5. [10 Tình Huống Thực Tế (Use Cases) Khi Khách Nhắn Tin & Cách Xử Lý](#5-10-tình-huống-thực-tế-use-cases-khi-khách-nhắn-tin--cách-xử-lý)
6. [Hiện Trạng Các Kênh Chat (Telegram, WhatsApp, Lark, Zalo, Messenger)](#6-hiện-trạng-các-kênh-chat-telegram-whatsapp-lark-zalo-messenger)
7. [Hướng Dẫn Thao Tác Kết Nối Kênh Trên Màn Hình Quản Trị](#7-hướng-dẫn-thao-tác-kết-nối-kênh-trên-màn-hình-quản-trị)
8. [Bảng Hỏi - Đáp Nhanh Dành Cho Nhân Viên Mới (FAQ)](#8-bảng-hỏi---đáp-nhanh-dành-cho-nhân-viên-mới-faq)

---

## 1. MỤC ĐÍCH & Ý NGHĨA CỦA HỆ THỐNG ĐỐI VỚI SELLER

Trong bán hàng trực tuyến, **tốc độ phản hồi quyết định 80% tỷ lệ chốt đơn**. Khách hàng nhắn tin hỏi mua hàng mà phải chờ đợi quá lâu thường sẽ lập tức sang hỏi shop đối thủ.

Hệ thống **Sales SLA Reminder** được ra đời không phải để "soi mói" hay gây áp lực cho nhân viên, mà đóng vai trò là một **Trợ lý ảo hỗ trợ Seller**:
- **Không bao giờ bỏ sót khách hàng:** Nhắc việc tự động khi bạn đang bận tư vấn khách khác hoặc đang đóng hàng.
- **Bảo vệ quyền lợi công bằng:** Thời gian đi ăn trưa, chuyển ca, ban đêm được **loại trừ 100%**. Hệ thống chỉ tính đúng thời gian bạn đang làm việc.
- **Ghi nhận thành tích minh bạch:** Mọi phản hồi nhanh, mọi sự chăm sóc khách hàng đều được số hóa thành điểm KPI minh bạch, không ai bị đánh giá cảm tính.

---

## 2. KHUNG GIỜ LÀM VIỆC, GIỜ NGHỈ & QUYỀN LỢI CỦA SELLER

Hệ thống chia một ngày làm việc thành **3 ca chính thức**, xen kẽ là các khoảng nghỉ được **đóng băng đồng hồ hoàn toàn**:

```
08:00          12:00         13:00          17:00         18:00          23:00         08:00
┌──────────────┐             ┌──────────────┐             ┌──────────────┐             ┌──────────────┐
│  CA 1 (SÁNG) │  NGHỈ TRƯA  │ CA 2 (CHIỀU) │ NGHỈ ĂN TỐI │  CA 3 (TỐI)  │   BAN ĐÊM   │  HÔM SAU...  │
│  08:00-12:00 │ 12:00-13:00 │ 13:00-17:00  │ 17:00-18:00 │ 18:00-23:00  │ 23:00-08:00 │              │
└──────────────┘             └──────────────┘             └──────────────┘             └──────────────┘
 ⏱️ Tính giờ     ⏸️ ĐÓNG BĂNG   ⏱️ Tính giờ     ⏸️ ĐÓNG BĂNG   ⏱️ Tính giờ    ⏸️ ĐÓNG BĂNG    ⏱️ Tính giờ
 ✅ Có nhắc việc ❌ KHÔNG nhắc  ✅ Có nhắc việc ❌ KHÔNG nhắc  ✅ Có nhắc việc ❌ KHÔNG nhắc   ✅ Có nhắc việc
```

### Bảng Chi Tiết Khung Giờ:

| Khung Giờ | Tính Chất | Đồng Hồ Tính Giờ | Bot Có Nhắn Tin Giục Không? | Quyền Lợi Của Seller |
| :--- | :--- | :---: | :---: | :--- |
| **08:00 – 12:00** | **Ca 1 (Sáng)** | ⏱️ Chạy bình thường | ✅ Có (nếu quá hạn quy định) | Bắt đầu ngày mới đầy năng lượng. |
| **12:00 – 13:00** | **Nghỉ trưa** | ⏸️ **TỰ ĐỘNG ĐÓNG BĂNG** | ❌ **TUYỆT ĐỐI KHÔNG** | Đi ăn trưa, nghỉ ngơi thoải mái, không lo bị tính điểm trễ. |
| **13:00 – 17:00** | **Ca 2 (Chiều)** | ⏱️ Chạy bình thường | ✅ Có (nếu quá hạn quy định) | Tiếp tục xử lý công việc buổi chiều. |
| **17:00 – 18:00** | **Nghỉ chuyển ca / Ăn tối** | ⏸️ **TỰ ĐỘNG ĐÓNG BĂNG** | ❌ **TUYỆT ĐỐI KHÔNG** | Bàn giao ca hoặc ăn tối, không bị bot làm phiền. |
| **18:00 – 23:00** | **Ca 3 (Tối)** | ⏱️ Chạy bình thường | ✅ Có (nếu quá hạn quy định) | Chăm sóc khách mua sắm online buổi tối. |
| **23:00 – 08:00 hôm sau** | **Ban đêm** | ⏸️ **TỰ ĐỘNG ĐÓNG BĂNG** | ❌ **TUYỆT ĐỐI KHÔNG** | Giấc ngủ trọn vẹn, đồng hồ không chạy, bot im lặng. |

> ⭐ **Quy Tắc Vàng Dành Cho Seller:** 
> - **Giờ nghỉ là của bạn!** Khách có nhắn tin lúc 12:15 trưa hay 02:00 đêm thì **đồng hồ tính giờ cũng KHÔNG chạy**, bot cũng **KHÔNG réo chuông**. Mọi tin nhắn đó đều chờ đến đúng đầu ca làm việc tiếp theo (13:00 hoặc 08:00 sáng hôm sau) mới bắt đầu tính giờ.

---

## 3. CÁCH HỆ THỐNG ĐO THỜI GIAN & NHẮC NHỞ (SLA LÀ GÌ?)

### 1. SLA là gì?
- **SLA (Service Level Agreement):** Là **thời gian tối đa cho phép** để nhân viên trả lời câu hỏi đầu tiên của khách hàng (Ví dụ công ty quy định: trong vòng **15 phút** phải có nhân viên trả lời khách).

### 2. Một lượt chăm sóc khách hàng diễn ra như thế nào?
1. **Khách hỏi ($T_0$):** Khách nhắn câu hỏi vào nhóm $\rightarrow$ Hệ thống bắt đầu tính giờ.
2. **Trong hạn phản hồi (0 - 15 phút):** Seller trả lời khách $\rightarrow$ Hệ thống đánh dấu: **"Đạt chuẩn - Trả lời đúng hạn"**.
3. **Nếu quá hạn (> 15 phút):** 
   - Hệ thống chuyển trạng thái sang **"Quá hạn (Overdue)"**.
   - Trợ lý ảo tự động gửi tin nhắn riêng (DM) vào Telegram/WhatsApp/Lark của Seller để nhắc việc:
     > 🔔 *"Chào bạn, khách hàng [Nguyễn Văn A] trong nhóm [Nhóm Khách VIP Hà Nội] đang chờ tư vấn câu hỏi: 'Shop còn áo màu đen size L không?' được 15 phút rồi. Bạn vào hỗ trợ khách nhé!"*
   - Cứ mỗi **5 phút** sau đó, nếu chưa ai hỗ trợ khách, bot sẽ tiếp tục gửi tin nhắc nhở lịch sự.
4. **Kết thúc lượt:** Khi bạn trả lời tin nhắn của khách hoặc thả emoji $\rightarrow$ Hệ thống đóng lượt tính giờ, **hủy toàn bộ các thông báo nhắc nhở dở dang ngay lập tức**.

---

## 4. 3 BÍ KÍP VÀNG GIÚP SELLER LUÔN ĐẠT 100% KPI PHẢN HỒI

### 💡 Bí Kíp 1: "1 Khách nhắn sao cũng được - Nhiều khách BẮT BUỘC phải Reply"
- **Khi trong nhóm chỉ có đúng 1 khách đang chờ:** Bạn gõ tin nhắn thường, gửi ảnh báo giá, hay gửi voice note... hệ thống đều tự hiểu bạn đang tư vấn cho vị khách đó và tự động đóng tính giờ ngay.
- **Khi trong nhóm có TỪ 2 KHÁCH TRỞ LÊN cùng đang hỏi:** Bạn **bắt buộc phải nhấn giữ tin nhắn của từng người và bấm "Reply (Trả lời)"**. 
  - *Tại sao?* Vì nếu bạn nhắn một câu vu vơ *"Dạ shop chào anh chị"*, bot không thể tự đoán bạn đang trả lời khách nào. Do đó bot sẽ **từ chối đóng tính giờ** để nhắc bạn phải tư vấn cụ thể từng người!

### 💡 Bí Kíp 2: "Thả Emoji (Thả Tim/Like) - Tuyệt chiêu đóng giờ trong 1 giây"
- Có những câu khách nhắn chỉ mang tính xác nhận: *"Cảm ơn em nhé"*, *"Ok shop"*, *"Mình nhận được hàng rồi"*.
- Bạn không cần tốn thời gian gõ chữ: Chỉ cần **thả một biểu cảm Emoji (❤️, 👍, 😊, 👌)** vào tin nhắn đó của khách.
- **Hệ thống sẽ lập tức đóng phiên tính giờ ngay trong 1 giây**, hủy toàn bộ thông báo nhắc nhở. Vừa thân thiện với khách, vừa giữ vững KPI của bạn!

### 💡 Bí Kíp 3: "Khách nhắn thêm câu hỏi trong 5 phút được tự động gom vào chung 1 lần"
- Nếu khách nhắn liên tục 3-4 tin kiểu: *"Shop ơi"* $\rightarrow$ *"Còn hàng không"* $\rightarrow$ *"Ship về Đà Nẵng bao nhiêu"*.
- Bạn yên tâm: Hệ thống tự động gom tất cả vào chung **1 lượt duy nhất**, bạn chỉ cần trả lời 1 lần là xong, không bị tính thành 4 lần trả lời riêng biệt!

---

## 5. 10 TÌNH HUỐNG THỰC TẾ (USE CASES) KHI KHÁCH NHẮN TIN & CÁCH XỬ LÝ

---

### Tình Huống 1: Nhóm chỉ có 1 khách nhắn 1 câu hỏi
* **Diễn biến:** 09:00 sáng, khách A nhắn: *"Shop tư vấn cho mình mẫu váy này nhé"*.
* **Seller cần làm gì:** Bạn chỉ cần gửi tin nhắn tư vấn bình thường (hoặc thả tim).
* **Kết quả:** Hệ thống ghi nhận bạn trả lời xong cho khách A, tính giờ dừng lại, đạt 100% KPI.

---

### Tình Huống 2: Hai khách hàng cùng nhắn câu hỏi trong 1 nhóm
* **Diễn biến:**
  - 09:10: Khách A nhắn *"Áo này bao nhiêu tiền?"*.
  - 09:12: Khách B nhắn *"Shop có ship COD không?"*.
* **Seller cần làm gì:** 
  - Nếu bạn nhắn tin thường không trích dẫn: Hệ thống **KHÔNG CHẤP NHẬN**, cả 2 khách vẫn bị tính là đang chờ.
  - Bạn phải: Nhấn **Reply** vào tin của khách A $\rightarrow$ Xong khách A. Sau đó nhấn **Reply** vào tin của khách B $\rightarrow$ Xong khách B.
* **Ý nghĩa:** Đảm bảo khách hàng cảm thấy được tôn trọng và giải đáp đúng trọng tâm câu hỏi của mình.

---

### Tình Huống 3: Sau khi đã Reply trả lời khách B, trong nhóm chỉ còn lại khách A
* **Diễn biến:** Tiếp nối tình huống 2, bạn đã Reply khách B rồi. Nhóm hiện tại chỉ còn lại khách A.
* **Seller cần làm gì:** Bạn **vẫn phải dùng nút Reply** vào tin của khách A!
* **Quy tắc hệ thống (Tính chất Sticky):** Vì trước đó nhóm có nhiều khách cùng hỏi, hệ thống đã "khóa" yêu cầu Reply cho khách A. Bạn không được nhắn tin thường mà phải Reply đúng câu hỏi của khách A thì mới được ghi nhận.

---

### Tình Huống 4: Khách nhắn nhiều tin liên tục trong vòng 5 phút (Gom tin)
* **Diễn biến:**
  - 10:00: Khách A nhắn *"Shop ơi"*.
  - 10:02: Khách A nhắn tiếp *"Cái này còn size M không"*.
  - 10:04: Khách A gửi thêm ảnh mẫu áo.
* **Hệ thống xử lý:** Toàn bộ các tin nhắn trên được gom vào chung 1 phiên tư vấn. Mốc giờ bắt đầu chờ tính từ **10:00**. Bạn chỉ cần trả lời 1 tin tổng hợp là giải quyết xong toàn bộ.

---

### Tình Huống 5: Khách nhắn thêm câu hỏi sau hơn 5 phút (Tách phiên riêng)
* **Diễn biến:**
  - 10:00: Khách A hỏi giá sản phẩm 1 (bạn chưa kịp trả lời).
  - 10:08 (cách hơn 5 phút): Khách A hỏi thêm giá sản phẩm 2.
* **Hệ thống xử lý:** Do cách nhau quá 5 phút, hệ thống tự động tách thành 2 câu hỏi độc lập. Để công bằng và rõ ràng, bạn nên dùng nút **Reply** trả lời từng câu hỏi cho khách.

---

### Tình Huống 6: Quá thời gian quy định mà chưa có ai trả lời (Quá hạn - Overdue)
* **Diễn biến:** Khách nhắn lúc 14:00, quy định phản hồi là 15 phút. Đến 14:15 vẫn chưa có Seller nào phản hồi.
* **Hệ thống xử lý:**
  - Hệ thống chuyển trạng thái sang **Quá hạn**.
  - Trợ lý ảo tự động gửi tin nhắn riêng (DM) vào tài khoản Telegram/WhatsApp của Seller phụ trách để nhắc nhở ngay lập tức.
  - Cứ mỗi 5 phút tiếp theo, bot sẽ gửi tin nhắc nhở cho đến khi có bạn vào trả lời khách.

---

### Tình Huống 7: Khách nhắn cảm ơn xã giao
* **Diễn biến:** Khách nhận được hàng và nhắn vào nhóm: *"Shop ơi mình nhận được rồi, vải đẹp lắm, cảm ơn shop nhiều!"*.
* **Seller xử lý:** Nhấn giữ tin nhắn của khách $\rightarrow$ Thả 1 chiếc biểu cảm ❤️ (Thả Tim) hoặc 👍 (Like).
* **Kết quả:** Phiên tư vấn được hoàn thành xuất sắc ngay tức khắc, không tốn thời gian gõ chữ, không bị bot nhắc nhở.

---

### Tình Huống 8: Khách nhắn sát giờ nghỉ trưa (Đóng băng đồng hồ & Chuyển ca)
* **Diễn biến:** 
  - Quy định phản hồi: 15 phút. Ca sáng kết thúc lúc 12:00 (bắt đầu nghỉ trưa 12:00 - 13:00).
  - Lúc **11:50** (chỉ còn 10 phút là hết ca sáng), khách nhắn câu hỏi.
* **Hệ thống xử lý & Quyền lợi của bạn:**
  - Trong ca sáng, bạn chỉ còn **10 phút** (từ 11:50 đến 12:00).
  - Đúng **12:00**, đồng hồ **DỪNG ĐẾM HOÀN TOÀN**. Bạn đi ăn trưa thoải mái, bot **KHÔNG BAO GIỜ** nhắc nhở bạn trong suốt 1 tiếng nghỉ trưa.
  - Bạn còn **5 phút** chưa dùng sẽ được chuyển sang đầu ca chiều.
  - Lúc **13:00** (bắt đầu ca chiều), đồng hồ đếm tiếp 5 phút $\rightarrow$ Hạn chót thực tế của bạn là **13:05**.
  - Nếu bạn trả lời lúc **13:02**, thời gian phản hồi của bạn chỉ được tính là **12 phút** (10 phút ca sáng + 2 phút ca chiều). Toàn bộ 60 phút nghỉ trưa không bị tính vào, bạn vẫn đạt 100% KPI!

---

### Tình Huống 9: Khách nhắn giữa giờ nghỉ trưa hoặc nửa đêm
* **Diễn biến:** Khách nhắn lúc **12:30 trưa** hoặc **01:00 sáng**.
* **Hệ thống xử lý:**
  - Hệ thống nhận diện tin nhắn ngoài giờ làm việc và **KHÔNG BẬT ĐỒNG HỒ TÍNH GIỜ**.
  - Bạn **KHÔNG BỊ LÀM PHIỀN** khi đang ngủ hoặc đang ăn trưa.
  - Giờ tính chỉ chính thức kích hoạt khi ca tiếp theo mở cửa:
    - Tin nhắn 12:30 trưa $\rightarrow$ Bắt đầu tính giờ từ **13:00 chiều** (hạn chót là 13:15).
    - Tin nhắn 01:00 sáng $\rightarrow$ Bắt đầu tính giờ từ **08:00 sáng hôm sau** (hạn chót là 08:15).
  - Đầu ca bạn vào trả lời là đạt chuẩn ngay!

---

### Tình Huống 10: Seller siêng năng trả lời ngay trong giờ nghỉ
* **Diễn biến:** Khách nhắn lúc 12:20 trưa (đang nghỉ). Bạn tiện tay cầm điện thoại thấy khách hỏi liền nhắn lại trả lời lúc 12:25.
* **Hệ thống xử lý:**
  - Ghi nhận bạn đã giải quyết xong tin nhắn của khách.
  - **Thời gian phản hồi được hệ thống tính là 0 PHÚT!** (Vì bạn trả lời trong giờ không bắt buộc).
  - Vừa giúp khách được chăm sóc siêu tốc, vừa giúp điểm KPI trung bình cả tháng của bạn đẹp tuyệt đối!

---

## 6. HIỆN TRẠNG CÁC KÊNH CHAT (TELEGRAM, WHATSAPP, LARK, ZALO, MESSENGER)

Để quản lý và nhân viên cùng nắm rõ, dưới đây là tình trạng kết nối thực tế của từng ứng dụng chat:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                       BẢNG ĐÁNH GIÁ HIỆN TRẠNG 5 KÊNH                       │
├────────────────────┬──────────────┬─────────────────────────────────────────┤
│ Kênh Chat          │ Trạng Thái   │ Đánh Giá Khả Thi & Thực Tế Vận Hành     │
├────────────────────┼──────────────┼─────────────────────────────────────────┤
│ 1. TELEGRAM        │ 🟢 100% Xong │ Hoạt động hoàn hảo, rất mượt, không lỗi.│
│ 2. WHATSAPP        │ 🟢 100% Xong │ Quét mã QR là chạy, tự động quét nhóm.  │
│ 3. LARK SUITE      │ 🟡 Nhóm Nội Bộ│ Tốt trong nội bộ, chưa hỗ trợ khách ngoài│
│ 4. ZALO            │ 🔴 Chưa được │ Zalo đóng API nhóm, bắt buộc có Zalo OA. │
│ 5. FB MESSENGER    │ 🔴 Chưa được │ Meta cấm bot vào Group chat Messenger.  │
└────────────────────┴──────────────┴─────────────────────────────────────────┘
```

### 1. Kênh TELEGRAM (Hoàn thành 100% - Khuyên dùng)
- **Điểm mạnh:**
  - Thêm nhiều Bot trực tiếp trên Dashboard, kết nối siêu nhanh.
  - Tự động nhận diện nhóm bán hàng: Cứ thêm bot vào nhóm là bot tự động theo dõi, không cần cài đặt gì thêm.
  - Nhân viên Sales xác thực danh tính dễ dàng qua mã OTP 6 số (gõ lệnh `/verify`).
  - Đo giờ chính xác, nhắc việc tận tay, đóng giờ bằng tin nhắn hoặc thả tim/like.
  - Tiêu tốn cực kỳ ít tài nguyên máy chủ.

### 2. Kênh WHATSAPP (Hoàn thành 100% - Rất tiện lợi)
- **Điểm mạnh:**
  - Thêm tài khoản WhatsApp bằng cách **quét mã QR trực tiếp trên màn hình Dashboard** (tương tự như đăng nhập WhatsApp Web).
  - **Tự động nhận diện nhóm:** Nhân viên đưa số WhatsApp này vào bất kỳ nhóm nào là hệ thống tự động theo dõi nhóm đó, không cần điền mã nhóm thủ công.
  - Tự động giải mã tên thật và số điện thoại của khách hàng.
  - Đo giờ, gửi tin nhắn nhắc nhở và đóng giờ bằng reaction emoji đầy đủ.
- **Lưu ý vận hành:**
  - Điện thoại cắm số WhatsApp giám sát cần duy trì kết nối mạng và pin để tránh bị ngắt kết nối.

### 3. Kênh LARK SUITE (Hoàn thành 100% trong phạm vi Nhóm Nội Bộ)
- **Điểm mạnh:** Nhận diện nhân viên, đo giờ và gửi tin nhắc việc cực kỳ chuẩn xác qua Webhook của Lark.
- **Rào cản thực tế:**
  - Theo chính sách của Lark, Bot chỉ có thể đọc tin nhắn trong các **Nhóm chat nội bộ của công ty**.
  - Không thể dùng cho nhóm chat với khách hàng tự do bên ngoài (trừ khi khách hàng cũng có tài khoản Lark doanh nghiệp và công ty mua gói Helpdesk trả phí rất đắt).

### 4. Kênh ZALO (Hiện tại CHƯA THỂ triển khai)
- **Tại sao chưa làm được?**
  - **Chính sách của Zalo:** Zalo chỉ cấp quyền kết nối (API) cho các tài khoản **Zalo Official Account (OA) Doanh Nghiệp** có giấy phép kinh doanh, con dấu và xác thực tick vàng.
  - **Zalo cá nhân đóng cửa hoàn toàn:** Zalo hoàn toàn không cung cấp cổng kết nối cho bot tham gia đọc tin trong các Nhóm Zalo cá nhân thông thường.
  - **Rủi ro:** Nếu dùng phần mềm không chính thức can thiệp để tự động đọc tin nhóm Zalo, tài khoản và số điện thoại sẽ bị Zalo quét và **khóa vĩnh viễn (ban số)** ngay lập tức.

### 5. Kênh FACEBOOK MESSENGER (Hiện tại CHƯA THỂ triển khai)
- **Tại sao chưa làm được?**
  - **Quy định bất di bất dịch của Meta (Facebook):** API chính thức của Facebook **chỉ cho phép Bot chat 1-1 với Fanpage**, hoàn toàn **KHÔNG HỖ TRỢ bot tham gia vào Nhóm chat Messenger (Group Chat)** gồm nhiều người.
  - Do đó, bài toán *"Đưa bot vào nhóm Messenger bán hàng để theo dõi nhân viên tư vấn cho khách"* là **bất khả thi về mặt công nghệ trên nền tảng của Facebook**.
  - Nếu dùng tài khoản Facebook cá nhân chạy công cụ tự động đọc nhóm, Facebook sẽ quét Checkpoint và khóa tài khoản chỉ sau vài giờ.

---

## 7. HƯỚNG DẪN THAO TÁC KẾT NỐI KÊNH TRÊN MÀN HÌNH QUẢN TRỊ

Quản trị viên thao tác cực kỳ dễ dàng tại màn hình **Quản Lý Kết Nối** (`/connections`):

### 1. Kết nối Telegram:
1. Mở Telegram, nhắn tin cho `@BotFather` để tạo bot và lấy chuỗi **Bot Token**.
2. Tắt chế độ riêng tư của bot: Nhắn `/mybots` $\rightarrow$ Chọn bot $\rightarrow$ **Bot Settings** $\rightarrow$ **Group Privacy** $\rightarrow$ Chọn **Turn OFF**.
3. Vào trang web quản trị $\rightarrow$ Tab **Telegram** $\rightarrow$ Dán Token vào ô $\rightarrow$ Bấm **Xác Thực & Kết Nối**.
4. Thêm Bot vào nhóm bán hàng $\rightarrow$ Xong!

### 2. Xác thực nhân viên Sales (Telegram):
1. Mỗi bạn Sales vào trang cá nhân lấy mã OTP 6 số.
2. Mở chat 1-1 với Bot Telegram của công ty $\rightarrow$ Gửi tin: `/verify <Mã_OTP>` (Ví dụ: `/verify 123456`).
3. Bot báo *"Xác thực thành công"* $\rightarrow$ Từ nay bot sẽ nhắc việc riêng cho bạn mỗi khi có khách chờ!

### 3. Kết nối WhatsApp:
1. Vào trang web quản trị $\rightarrow$ Tab **WhatsApp** $\rightarrow$ Bấm **"Kết nối số mới"**.
2. Một bảng mã QR sẽ hiện lên trên màn hình máy tính.
3. Mở ứng dụng WhatsApp trên điện thoại $\rightarrow$ Chọn **Thiết bị liên kết (Linked Devices)** $\rightarrow$ Bấm **Liên kết thiết bị** $\rightarrow$ Quét mã QR trên màn hình.
4. Màn hình báo xanh *"Đã kết nối thành công"* $\rightarrow$ Xong! Bạn chỉ cần thêm số này vào các nhóm bán hàng là xong.

---

## 8. BẢNG HỎI - ĐÁP NHANH DÀNH CHO NHÂN VIÊN MỚI (FAQ)

#### ❓ Câu hỏi 1: Nếu em đang bận ăn trưa lúc 12:15 mà khách nhắn, em có bị trừ điểm KPI không?
> **Trả lời:** **Hoàn toàn KHÔNG!** Từ 12:00 đến 13:00 là giờ nghỉ trưa chính thức, hệ thống tự động đóng băng đồng hồ. Bạn cứ ăn trưa và nghỉ ngơi, 13:00 chiều đồng hồ mới bắt đầu tính giờ.

#### ❓ Câu hỏi 2: Khách nhắn lúc 23:30 đêm, sáng hôm sau em phải trả lời trước mấy giờ?
> **Trả lời:** Hệ thống đóng băng suốt đêm. Đến đúng **08:00 sáng hôm sau** đồng hồ mới bắt đầu tính giờ. Nếu công ty quy định 15 phút, bạn chỉ cần trả lời trước **08:15 sáng** là đạt chuẩn 100% đúng hạn!

#### ❓ Câu hỏi 3: Trong nhóm có 2 khách cùng hỏi, em nhắn một câu: "Dạ em chào anh chị, em hỗ trợ liền ạ" thì có được tính không?
> **Trả lời:** **KHÔNG ĐƯỢC TÍNH!** Khi có từ 2 khách cùng hỏi, bạn bắt buộc phải **bấm Reply** vào tin của từng người. Nhắn tin chung chung sẽ bị bot bỏ qua vì bot không biết bạn đang trả lời ai, và cả 2 khách sẽ tiếp tục bị tính là đang chờ.

#### ❓ Câu hỏi 4: Khách chỉ nhắn câu: "Ok cảm ơn em nhé", em có cần gõ chữ trả lời không?
> **Trả lời:** Không cần gõ chữ! Bạn chỉ cần **thả 1 chiếc Emoji (Tim ❤️ hoặc Like 👍)** vào tin nhắn đó của khách. Hệ thống sẽ tự động hoàn thành lượt tư vấn ngay lập tức!

#### ❓ Câu hỏi 5: Em có thể xem lại lịch sử và điểm số phản hồi của mình ở đâu?
> **Trả lời:** Bạn có thể vào trực tiếp Dashboard của công ty tại mục **Báo Cáo Phản Hồi (Reports)** để theo dõi chi tiết số phút phản hồi trung bình, số lượt đúng hạn và tỷ lệ tuân thủ theo từng ca làm việc của mình.

---

*(Tài liệu này được lưu trữ chính thức tại thư mục `docs/ARCHITECTURE_AND_SLA_SYSTEM.md` của dự án để toàn thể công ty tra cứu và đào tạo nhân viên mới).*
