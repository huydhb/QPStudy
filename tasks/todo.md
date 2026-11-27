# Task Checklist: QP Study — Claymorphism Educational Landing Page

> Kế hoạch chi tiết xem tại `tasks/plan.md`. Thực hiện tuần tự theo từng phase và dừng kiểm tra tại các Checkpoint.

---

## Phase 1: Foundation

## Task 1: Đóng gói font tiếng Việt cục bộ (`Baloo 2` + `Nunito`) và cập nhật favicon

**Description:** Tải các file font `.woff2` (subset `vietnamese` + `latin`) của `Baloo 2` (600, 700, 800) và `Nunito` (400, 500, 600, 700, 800) vào `assets/fonts/`, tạo `assets/fonts/fonts.css` khai báo `@font-face` (`font-display: swap`), nhúng vào `index.html` (đồng thời cập nhật `<meta name="theme-color" content="#fff9f5">`), và làm mới `assets/favicon.svg` theo phong cách Claymorphism (`#fdbcb4` + viền `#2d3748`).

**Acceptance criteria:**
- [x] Thư mục `assets/fonts/` chứa đủ file `.woff2` và `fonts.css` không gọi URL mạng ngoài.
- [x] `index.html` nạp `assets/fonts/fonts.css` trước `styles.css`; chữ tiếng Việt có dấu (như `Ôn chắc kiến thức`, `Đường lối`, `Kiểm tra`) hiển thị đúng bằng `Baloo 2` (heading) và `Nunito` (body).
- [x] `assets/favicon.svg` sắc nét, khớp bảng màu mẫu tham chiếu.

**Verification:**
- [x] Tests pass: `node --test tests/core.test.cjs`
- [x] Manual check: Mở trang qua `http://127.0.0.1` kiểm tra mọi file font trả về HTTP 200 và `document.fonts` nạp thành công `Baloo 2` và `Nunito`.

**Dependencies:** None

**Files likely touched:**
- `assets/fonts/fonts.css`
- `assets/fonts/*.woff2`
- `assets/favicon.svg`
- `index.html`

**Estimated scope:** Small (3-4 files)

---

## Task 2: Thiết lập hệ thống CSS Tokens và Claymorphism primitives

**Description:** Cập nhật `:root` và phần Base trong `styles.css` theo đúng bảng màu (`#ffffff`, `#fff9f5`, `#fdbcb4`, `#add8e6`, `#e6e6fa`, `#98ff98`, `#22c55e`, `#15803d`, `#2d3748`, `#526074`, `#e2e8f0`, `#facc15`), font families (`Baloo 2` / `Nunito`), và định nghĩa các lớp nền tảng tái sử dụng: `.clay-card`, `.soft-clay`, `.btn-primary`, `.btn-secondary`, `.clay-pill`, `.icon-box`, `.section-band` (xen kẽ nền trắng/kem/xanh trời, `max-width: 1152px`), focus-visible WCAG AA và `prefers-reduced-motion`.

**Acceptance criteria:**
- [x] Đủ biến CSS token trong `:root` và các lớp `.clay-card`, `.soft-clay`, `.btn-primary`, `.btn-secondary`, `.clay-pill`, `.icon-box` khớp thông số viền `3px`, bo góc `16px`/`24px` và bóng đổ kép của mẫu tham chiếu.
- [x] Tương phản chữ trên mọi bề mặt đạt tối thiểu `4.5:1` (nút `.btn-primary` dùng `#15803d` với chữ trắng `#fff`).
- [x] Tôn trọng `@media (prefers-reduced-motion: reduce)` và giữ `focus-visible` rõ nét cho bàn phím.

**Verification:**
- [x] Tests pass: `node --test tests/core.test.cjs`
- [x] Manual check: Kiểm tra không có lỗi cú pháp CSS và không làm vỡ layout cơ bản của các view hiện có.

**Dependencies:** Task 1

**Files likely touched:**
- `styles.css`

**Estimated scope:** Small (1 file)

---

## Checkpoint: After Tasks 1-2 (Foundation)
- [x] `node --test tests/core.test.cjs` pass (10/10)
- [x] Font `Baloo 2` + `Nunito` tải cục bộ HTTP 200, hiển thị tiếng Việt sắc nét
- [x] Không có lỗi console hay lỗi cú pháp CSS

---

## Phase 2: Landing Shell & Core Learning Workspace

## Task 3: Nâng cấp Floating Claymorphism Navbar (kèm menu mobile) và Footer 5 cột

**Description:** Cập nhật `<header>` và `<footer>` trong `index.html` cùng tương tác trong `app.js` và style trong `styles.css` theo mẫu Floating Navbar (`.clay-card` cố định phía trên) và Footer 5 cột trên nền kem. Desktop hiển thị logo `QP Study`, các liên kết điều hướng (`Khóa học`, `Lợi ích`, `Nhận xét`, `Góc học tập` `[data-nav="home"]`, `Lịch sử` `[data-nav="history"]`) và nút CTA (`Bắt đầu ngay`). Mobile (`<768px`) thu gọn thành nút hamburger sky-blue `44×44px` mở menu thả xuống có `aria-expanded`, đóng khi chọn mục hoặc bấm `Escape`.

**Acceptance criteria:**
- [x] Navbar nổi `.clay-card` cố định ở trên, không tràn ngang từ `375px` đến `1440px`, giữ nguyên nút `[data-nav="home"]`, `[data-nav="history"]` và click logo về `home`.
- [x] Menu mobile mở/đóng mượt, hỗ trợ bàn phím (`Escape` đóng menu, trả focus về nút hamburger), liên kết mục lục cuộn tới đúng section (`scroll-margin-top` tránh bị navbar che).
- [x] Footer 5 cột trên desktop (1 cột trên mobile) có các liên kết thao tác thật (chọn QP1, chọn QP2, mở tạo đề, mở lịch sử, cuộn tới lợi ích) và thanh bản quyền dưới cùng.

**Verification:**
- [x] Tests pass: `node --test tests/core.test.cjs`
- [x] Manual check: Kiểm tra click từng link trên desktop & mở/đóng menu mobile ở `375px`, xác nhận không tràn ngang.

**Dependencies:** Task 2

**Files likely touched:**
- `index.html`
- `styles.css`
- `app.js`

**Estimated scope:** Medium (3 files)

---

## Task 4: Xây dựng Hero Section kèm Thẻ tiến độ học động và 3 badge SVG nổi

**Description:** Thiết kế lại phần Hero trong `renderHome()` (`app.js`) và `styles.css` trên nền `--bg-cream` (`#fff9f5`), chia 2 cột trên desktop (`>=1024px`). Cột trái gồm pill mint `"340 câu hỏi chuẩn giáo trình · Học offline"`, H1 tiếng Việt nhấn xanh lá, mô tả, 2 nút CTA (`Bắt đầu học miễn phí →`, `Tạo đề kiểm tra`) và 3 chỉ số thống kê thật (`340` câu hỏi, `17` bài học, số câu đã luyện / lượt hoàn thành). Cột phải là **Thẻ tiến độ học** (`.clay-card`) tính toán từ dữ liệu thật (`active` session nếu đang làm dở -> nút `Tiếp tục làm bài` `[data-action="resume"]`, hoặc tiến độ học phần hiện tại -> nút luyện bài tiếp theo), kèm 3 badge pastel nổi dùng inline SVG (không dùng emoji).

**Acceptance criteria:**
- [x] Hero có đủ khoảng đệm phía trên (`>=116px` mobile / `>=136px` desktop) để Floating Navbar không che khuất pill đầu trang.
- [x] Thẻ tiến độ hiển thị % tiến độ thật, thanh tiến độ xanh lá viền `2px`, hoạt động đúng ở cả 2 trạng thái (chưa có phiên dở vs đang có `active` session) và hiển thị gọn không tràn ngang trên điện thoại (`375px`).
- [x] Toàn bộ icon là inline SVG; không có emoji làm icon.

**Verification:**
- [x] Tests pass: `node --test tests/core.test.cjs`
- [x] Manual check: Kiểm tra Hero ở `1440px` và `375px` cả khi trống lịch sử và khi có phiên đang làm dở.

**Dependencies:** Task 3

**Files likely touched:**
- `app.js`
- `styles.css`

**Estimated scope:** Small (2 files)

---

## Task 5: Xây dựng mục Khóa học nổi bật (lưới 2×2) tích hợp Góc luyện tập và Hộp tạo đề

**Description:** Thiết kế lại khu học tập trên nền trắng `#ffffff` (`#courses`) theo bố cục Featured Courses của mẫu tham chiếu: pill sky-blue, H2 + phụ đề, banner tiếp tục phiên đang làm (`resume-banner` nếu có), lưới 2×2 `.clay-card` nổi bật (2 thẻ chọn học phần `QP1` `[data-course="qp1"]`, `QP2` `[data-course="qp2"]` kèm tiến độ % & pill đánh giá; 2 thẻ thao tác nhanh: Đề kiểm tra tổng hợp `[data-action="exam"]` và Lịch sử & Ôn tập `[data-nav="history"]`), nối liền bảng **Luyện tập theo bài** (`.lesson-panel`) và hộp **Tạo đề kiểm tra** (`.exam-panel` giữ chính xác `<h3>Kiểm tra kiến thức của bạn</h3>`), kèm nút `.btn-secondary` cuối mục.

**Acceptance criteria:**
- [x] Chọn `QP1` / `QP2` bằng chuột hoặc phím `Enter` cập nhật danh sách bài ngay lập tức và giữ focus trên nút `[data-course="..."]`.
- [x] Bài 1 QP1 vẫn `disabled` (`Chưa có dữ liệu`); bấm bất kỳ bài hợp lệ (`data-lesson`) mở modal cấu hình luyện tập; bấm `[data-action="exam"]` mở modal tạo đề.
- [x] Selector `.exam-panel h3` giữ đúng văn bản `"Kiểm tra kiến thức của bạn"` để đảm bảo tương thích bộ test tự động.

**Verification:**
- [x] Tests pass: `node --test tests/core.test.cjs`
- [x] Browser test pass: `python tests/browser_check.py`

**Dependencies:** Task 4

**Files likely touched:**
- `app.js`
- `styles.css`

**Estimated scope:** Small (2 files)

---

## Checkpoint: After Tasks 3-5 (Core Landing + Existing Flows)
- [x] `node --test tests/core.test.cjs` pass (10/10)
- [x] `python tests/browser_check.py` pass hoàn toàn (file:// + HTTP 200, 3 chế độ, resume, replace dialog, validation, focus, filter, QP2, storage, 4 viewports)
- [x] Kiểm tra nhanh bố cục trên desktop (`1440px`) và mobile (`375px`)

---

## Phase 3: Remaining Landing Sections, App-Wide Polish & QA

## Task 6: Xây dựng 3 mục Lợi ích, Nhận xét học viên và Lời mời đăng ký mục tiêu học tập

**Description:** Bổ sung 3 section còn lại của landing page vào `renderHome()` (`app.js`) và tạo kiểu trong `styles.css` khớp nhịp màu xen kẽ của mẫu tham chiếu:
1. **Lợi ích (`#benefits`, nền `--bg-cream`)**: Pill peach, H2, lưới 4 thẻ `.soft-clay` (4 icon pastel `64×64` viền `3px`).
2. **Nhận xét học viên (`#testimonials`, nền `#ffffff`)**: Pill mint, H2, lưới 3 thẻ `.clay-card` có 5 sao vàng SVG, nội dung nhận xét tiếng Việt và avatar chữ cái đầu pastel `48×48`.
3. **Lời mời đăng ký (`#signup`, nền `--secondary` `#add8e6`)**: Khung `.clay-card` nền trắng căn giữa (`max-width: 896px`), H2, phụ đề, form nhỏ lưu tên & mục tiêu ôn tập cục bộ (`qp-profile-v1` qua `store` an toàn khi storage bị chặn) kèm 2 nút CTA chính/phụ và 2 dòng cam kết có tick xanh.

**Acceptance criteria:**
- [x] Đủ 3 section với màu nền xen kẽ đúng mẫu (`#fff9f5` -> `#ffffff` -> `#add8e6`), lưới responsive mượt (`4→2→1` cho Lợi ích, `3→1` cho Nhận xét).
- [x] Gửi form đặt mục tiêu hiển thị xác nhận thân thiện (`role="status"`), lưu vào `localStorage` (nếu cho phép) và cập nhật lời chào/mục tiêu trên thẻ tiến độ Hero mà không gây lỗi khi `localStorage` bị chặn.
- [x] Các nút CTA trong section hoạt động thật (cuộn tới chọn bài / mở modal tạo đề).

**Verification:**
- [x] Tests pass: `node --test tests/core.test.cjs`
- [x] Browser test pass: `python tests/browser_check.py`

**Dependencies:** Task 5

**Files likely touched:**
- `app.js`
- `styles.css`

**Estimated scope:** Small (2 files)

---

## Task 7: Đồng bộ Claymorphism cho Quiz, Result, History, Dialog và Nghiệm thu toàn diện

**Description:** Nâng cấp style của các view phụ (`.question-panel`, `.answer-option`, `.question-sidebar`, `.grid-cell`, `.timer`, `.result-hero`, `.breakdown`, `.review-card`, `.history-card`, `.empty-state`, `<dialog>` và các input/radio/checkbox) trong `styles.css` đồng bộ hoàn toàn ngôn ngữ Claymorphism (viền `3px`, bo góc `16px`–`24px`, màu đúng/sai rõ ràng dễ đọc). Mở rộng `tests/browser_check.py` để kiểm tra thêm menu mobile, các section landing page mới (Hero progress card, Benefits, Testimonials, Signup goal form), rồi chạy toàn bộ kiểm thử và duyệt ảnh chụp desktop + mobile.

**Acceptance criteria:**
- [x] Tất cả 4 màn hình (Home, Quiz, Result, History) và `<dialog>` đồng nhất phong cách Claymorphism, rõ tương phản (`>= 4.5:1`), không vỡ bố cục ở `375px`, `768px`, `1024px`, `1440px`.
- [x] `tests/browser_check.py` kiểm chứng cả luồng cũ lẫn các thành phần landing page mới (navbar mobile toggle, thẻ tiến độ, 4 thẻ lợi ích, 3 nhận xét, form mục tiêu, footer).
- [x] Ảnh chụp `tests/artifacts/home-desktop.png`, `home-mobile.png`, `quiz-desktop.png`, `result-desktop.png` được mở kiểm tra trực quan, sạch lỗi cắt chữ/tràn khung/đè navbar.

**Verification:**
- [x] Tests pass: `node --test tests/core.test.cjs`
- [x] Browser test pass: `python tests/browser_check.py`
- [x] Visual check: Xem lại các ảnh chụp trong `tests/artifacts/` đối chiếu mẫu `uupm.cc/demo/educational-platform`.

**Dependencies:** Task 6

**Files likely touched:**
- `styles.css`
- `app.js`
- `tests/browser_check.py`

**Estimated scope:** Medium (3 files)

---

## Checkpoint: Complete (After Task 7)
- [x] `node --test tests/core.test.cjs` pass 100%
- [x] `python tests/browser_check.py` pass 100% (cả `file://` và HTTP, toàn bộ response 200, 0 lỗi console/pageerror)
- [x] Không tràn ngang trên `375px`, `768px`, `1024px`, `1440px` ở mọi view
- [x] Đã kiểm tra trực quan ảnh chụp màn hình desktop và mobile
- [x] Sẵn sàng bàn giao và đẩy lên GitHub Pages (`main`)

---

## Phase 4: Quiz Auto-Advance UX & Per-Question Timing Analytics

## Task 8: Mở rộng `core.js` hỗ trợ đếm giây từng câu và tổng hợp phân tích thời gian

**Description:** Thêm `questionTimes` vào `createSession()`, hàm `recordQuestionTime(session, questionId, deltaMs)` và mở rộng `summarize()` trong `core.js` để xuất `activeElapsed` cùng `timeStats` (tổng thời gian thực xem câu, trung bình/câu, câu nhanh nhất/lâu nhất, trung bình câu đúng vs sai, danh sách chi tiết từng câu).

**Acceptance criteria:**
- [x] `recordQuestionTime` từ chối phiên đã nộp, ID không hợp lệ hoặc `deltaMs <= 0`.
- [x] `summarize().timeStats` tính chính xác từng câu, fastest/slowest và tách biệt đúng/sai.
- [x] Toàn bộ unit test cũ và mới trong `tests/core.test.cjs` pass.

**Verification:**
- [x] Tests pass: `node --test tests/core.test.cjs`

---

## Task 9: Bộ đếm giây chỉ tính khi thấy câu hỏi và màn hình phân tích sau khi làm xong

**Description:** Bổ sung bộ đếm thời gian gắn với trạng thái hiển thị thực của câu hỏi trong `app.js` (chỉ chạy khi `view === 'quiz'`, tab đang hiển thị `!document.hidden`, không mở `#dialog`, và dừng ngay khi chuyển về Góc học tập/Lịch sử, ẩn tab hoặc thoát trang) cùng khối **Phân tích thời gian làm bài** và thời gian từng câu trên màn hình Kết quả.

**Acceptance criteria:**
- [x] Thoát khỏi phòng thi (về Góc học tập, Lịch sử, chuyển tab, đóng trang, mở dialog) thì bộ đếm câu và đồng hồ phiên không đếm giờ chờ.
- [x] Màn hình Kết quả hiển thị tổng thời gian thực, trung bình/câu, câu nhanh nhất/chậm nhất, so sánh tốc độ đúng/sai, biểu đồ thanh thời gian từng câu (click nhảy tới câu tương ứng) và thời gian trên từng `.review-card`.

**Verification:**
- [x] Tests pass: `node --test tests/core.test.cjs`
- [x] Browser test pass: `python tests/browser_check.py`

---

## Task 10: Tối ưu UX tự chuyển câu khi chọn đúng + Kiểm thử toàn diện

**Description:** Khi người dùng chọn đáp án **đúng** ở chế độ `Chọn đến khi đúng` (`retry`) hoặc `Hiện kết quả ngay` (`instant`), hiển thị phản hồi xanh rõ ràng kèm thanh đếm ngắn (~850ms) rồi tự chuyển sang câu kế tiếp (hoặc câu chưa làm tiếp theo; giữ nguyên ở câu cuối để xác nhận nộp bài), có nút bật/tắt `"Tự qua câu khi đúng"` và tự hủy chuyển câu nếu người dùng bấm `Xem lại`, chuyển câu thủ công hoặc thoát. Cập nhật `tests/browser_check.py` kiểm chứng cả 2 tính năng mới và kiểm tra ảnh chụp màn hình.

**Acceptance criteria:**
- [ ] Chọn đúng trong chế độ `retry` / `instant` tự chuyển câu mượt mà sau ~850ms; chọn sai hoặc ở chế độ `end` không tự nhảy.
- [ ] Bấm `Xem lại`, `Câu trước`, `Câu tiếp`, bảng câu hoặc tắt toggle sẽ hủy tự chuyển câu ngay lập tức.
- [ ] `tests/core.test.cjs` và `tests/browser_check.py` (bao gồm test auto-advance và pause timer/analytics) pass 100%.

**Verification:**
- [ ] Tests pass: `node --test tests/core.test.cjs`
- [ ] Browser test pass: `python tests/browser_check.py`
- [ ] Visual check: Kiểm tra ảnh chụp `quiz-desktop.png` và `result-desktop.png`.
