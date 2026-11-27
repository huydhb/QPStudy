# Implementation Plan: QP Study — Claymorphism Educational Landing Page

## Overview
Thiết kế lại và mở rộng trang chủ của nền tảng ôn tập **QP Study** (`Ôn Tập/Web-QP`) thành landing page nền tảng học tập tiếng Việt mang phong cách **Claymorphism vui nhộn**, tham chiếu trực quan từ `https://www.uupm.cc/demo/educational-platform` ("LearnHub"). Triển khai hoàn toàn bằng công nghệ sẵn có của dự án (**Vanilla HTML5, CSS3, JavaScript thuần — không build step, chạy được offline / `file://` và GitHub Pages**), đồng thời bảo toàn 100% dữ liệu 340 câu hỏi (`QP1`, `QP2`), toàn bộ luồng luyện tập/kiểm tra/lịch sử và bộ kiểm thử tự động (`tests/core.test.cjs`, `tests/browser_check.py`).

---

## Visual Reference Audit (`uupm.cc/demo/educational-platform` + `ui-ux-pro-max`)

### 1. Bố cục 7 phần theo mẫu tham chiếu (nền xen kẽ)
1. **Floating Navbar**: Thanh `.clay-card` nổi cố định (`top: 16px`, `max-width: 1152px`, bo `24px`, viền `3px solid #2d3748`, bóng `6px 6px 0 #2d3748`). Mobile thu gọn thành nút hamburger màu xanh da trời (`44×44px`).
2. **Hero + Thẻ tiến độ học** *(nền `--bg-cream: #fff9f5`)*: Chia 2 cột trên desktop (`>=1024px`). Trái: pill mint, H1 lớn có từ khóa nhấn xanh lá, mô tả, 2 nút CTA (`.btn-primary`, `.btn-secondary`), 3 chỉ số thật. Phải: `.clay-card` tiến độ học thật (kết nối `localStorage` & phiên đang làm) + 3 floating pastel badges dùng icon SVG. *(Khắc phục lỗi của mẫu gốc: tăng padding-top mobile lên `>=116px` để navbar nổi không che mất pill; vẫn hiển thị thẻ tiến độ gọn trên điện thoại).*
3. **Danh sách khóa học nổi bật + Góc luyện tập & Tạo đề** *(nền `#ffffff`)*: Pill sky-blue, H2, lưới 2×2 `.clay-card` (2 thẻ chọn học phần `QP1` / `QP2` + 2 thẻ hành động nhanh Đề kiểm tra tổng hợp & Lịch sử/Ôn câu sai) nối liền khu danh sách bài `.lesson-panel` và hộp `.exam-panel` (`<h3>Kiểm tra kiến thức của bạn</h3>`) cùng nút phụ `.btn-secondary`.
4. **Lợi ích (Benefits)** *(nền `--bg-cream: #fff9f5`)*: Pill peach, H2, lưới 4 cột thẻ `.soft-clay` (không viền đen, bóng mềm 3D + 4 icon box pastel `64×64` viền `3px`).
5. **Nhận xét học viên (Testimonials)** *(nền `#ffffff`)*: Pill mint, H2, lưới 3 cột `.clay-card` với 5 sao vàng SVG (`#facc15`), nhận xét tiếng Việt tự nhiên và avatar chữ cái đầu pastel `48×48`.
6. **Lời mời đăng ký / Mục tiêu học tập (Signup CTA)** *(nền `--secondary: #add8e6`)*: Khung `.clay-card` nền trắng căn giữa (`max-width: 896px`), H2, phụ đề, form gọn đặt mục tiêu/tên học viên lưu cục bộ `localStorage` (tùy chọn, không bắt buộc), 2 nút CTA và 2 dấu tick cam kết.
7. **Footer** *(nền `--bg-cream: #fff9f5`)*: Lưới 5 cột trên desktop (Brand 2 cột + 3 cột liên kết: Học phần, Chế độ học, Thông tin), đường chia `3px solid #e2e8f0` và dòng bản quyền.

### 2. Bảng màu & Hệ thống Token
| Token | Giá trị | Vai trò & Ghi chú tương phản |
| :--- | :--- | :--- |
| `--bg` | `#ffffff` | Nền thẻ & các section sáng (Courses, Testimonials) |
| `--bg-cream` | `#fff9f5` | Nền ấm cho Hero, Benefits, Footer & Quiz/History |
| `--primary` | `#fdbcb4` | Đào pastel (logo, pill Benefits, icon/avatar #1) |
| `--primary-dark` | `#f5a69d` | Đào đậm khi hover/nhấn |
| `--secondary` | `#add8e6` | Xanh trời pastel (nền section CTA, `.btn-secondary`, pill Courses, icon #2) |
| `--secondary-dark` | `#8bc4d6` | Xanh trời đậm khi hover |
| `--accent-purple` | `#e6e6fa` | Tím pastel (icon/avatar #3, badge nổi) |
| `--accent-mint` | `#98ff98` | Bạc hà pastel (pill Hero & Testimonials, icon #4) |
| `--cta` | `#22c55e` | Xanh lá nổi bật cho thanh tiến độ, viền rating pill, dấu tick, nhấn H1 |
| `--cta-btn` | `#15803d` | Nền `.btn-primary` (chữ trắng `#fff` đạt tương phản **5.02:1**, chuẩn WCAG AA) |
| `--cta-btn-hover` | `#166534` | Trạng thái hover `.btn-primary` |
| `--text` | `#2d3748` | Chữ chính, viền `3px solid`, bóng khối claymorphism (`>=11:1` trên nền trắng/kem) |
| `--text-muted` | `#526074` | Chữ phụ (tinh chỉnh từ `#64748b` để đạt `>=5.8:1` trên nền `#fff9f5`) |
| `--border` | `#e2e8f0` | Rãnh thanh tiến độ & đường kẻ phân tách footer |
| `--star` | `#facc15` | Màu 5 ngôi sao đánh giá |

### 3. Typography (Hỗ trợ đầy đủ tiếng Việt + Offline)
- **Heading (`h1`–`h4`, brand, thống kê)**: `Baloo 2` (weights `600, 700, 800`) — kiểm chứng thực tế cho thấy `Fredoka` của mẫu tiếng Anh **không có subset `vietnamese`**, trong khi `Baloo 2` có cùng phong cách bo tròn vui nhộn, được `ui-ux-pro-max` khuyến nghị cho giáo dục Claymorphism và hỗ trợ đầy đủ dấu tiếng Việt.
- **Body & UI**: `Nunito` (weights `400, 500, 600, 700, 800`) — giống hệt mẫu tham chiếu và có đầy đủ subset `vietnamese`.
- **Self-host cục bộ (`assets/fonts/`)**: Lưu `.woff2` (latin + vietnamese) ngay trong dự án và nạp qua `@font-face` để chạy 100% offline, không gọi mạng ngoài và đảm bảo kiểm tra HTTP 200 trong `tests/browser_check.py`.

### 4. Công thức Claymorphism & Quy chuẩn UI/UX
- **`.clay-card`**: `border: 3px solid var(--text); border-radius: 24px; box-shadow: 6px 6px 0 var(--text), inset 0 -4px 0 rgba(0,0,0,0.1);` — hover: `translate(2px, 2px)` + `4px 4px 0 var(--text)` (`200ms`).
- **`.soft-clay`**: `border-radius: 24px; box-shadow: 0 8px 30px rgba(0,0,0,0.08), inset 0 -4px 0 rgba(0,0,0,0.05);` — hover nâng nhẹ (`200ms`).
- **`.btn-primary` / `.btn-secondary`**: `border: 3px solid var(--text); border-radius: 16px; box-shadow: 4px 4px 0 var(--text);` — hover: `translate(2px, 2px)` + `2px 2px 0 var(--text)` (`150ms`).
- **Icons**: 100% inline SVG sắc nét (`aria-hidden="true"` khi trang trí), **không dùng emoji làm icon**.
- **Accessibility**: Focus ring rõ ràng (`3px solid`), `prefers-reduced-motion: reduce`, vùng chạm `>= 44×44px`, tương phản văn bản `>= 4.5:1`, không trượt ngang ở `375px`, `768px`, `1024px`, `1440px`.

---

## Architecture Decisions
1. **Giữ nguyên công nghệ Vanilla HTML/CSS/JS**: Không thêm React/Tailwind/bundler vì dự án hiện chạy trực tiếp bằng `index.html` trên `file://` và GitHub Pages tĩnh, không bước build.
2. **Không sửa `core.js` và `data/questions.js`**: Giữ nguyên lõi nghiệp vụ, 340 câu hỏi và toàn bộ 10 unit test trong `tests/core.test.cjs`.
3. **Bảo toàn 100% hợp đồng DOM cho tính năng & test hiện có**: Giữ chính xác các selector/thuộc tính mà `app.js` và `tests/browser_check.py` sử dụng (`[data-nav="home"]`, `[data-nav="history"]`, `[data-course="qp1|qp2"]`, `[data-lesson]`, `[data-action="exam|resume|home|..."]`, `.exam-panel h3` đúng văn bản `"Kiểm tra kiến thức của bạn"`, `#dialog`, `#setup-form`, `#storage-warning`, v.v.).
4. **Tính năng "Lời mời đăng ký" thực dụng cho app offline**: Vì ứng dụng không có backend/tài khoản, phần Signup CTA cho phép người dùng **lưu tên & mục tiêu ôn tập mỗi ngày (lưu cục bộ vào `qp-profile-v1` qua `C.storage`)** để cá nhân hóa thẻ tiến độ Hero, đi kèm nút bắt đầu luyện tập ngay và tạo đề thi thử (hoàn toàn không bắt buộc nhập mới được học).
5. **Đồng bộ phong cách cho Quiz, Result, History & Dialog**: Áp dụng cùng bảng màu, viền claymorphism và font `Baloo 2` + `Nunito` xuyên suốt toàn bộ 4 view để không bị đứt gãy trải nghiệm khi chuyển từ Landing Page vào làm bài.

---

## Dependency Graph
```text
Task 1 (Local Fonts + Favicon)
    │
    └── Task 2 (CSS Tokens + Claymorphism Primitives)
            │
            ├── Task 3 (Floating Navbar + Mobile Menu + 5-Column Footer)
            │       │
            │       ├── Task 4 (Hero + Dynamic Learning Progress Card)
            │       │
            │       ├── Task 5 (Featured Courses 2x2 + Lesson/Exam Workspace)
            │       │       │
            │       │       └── [Checkpoint 2: Core Landing + Existing Flows]
            │       │
            │       └── Task 6 (Benefits + Testimonials + Signup Goal CTA)
            │               │
            │               └── Task 7 (Claymorphism Quiz/Result/History/Dialog + Full Responsive QA)
            │                       │
            │                       └── [Checkpoint 3: Full Verification & Screenshot Review]
            │
            └── [Checkpoint 1: Foundation Check]
```

---

## Task List

### Phase 1: Foundation
- [ ] **Task 1**: Đóng gói font tiếng Việt cục bộ (`Baloo 2` + `Nunito`) và cập nhật favicon Claymorphism (`assets/fonts/*`, `assets/favicon.svg`, `index.html`)
- [ ] **Task 2**: Xây dựng nền tảng CSS Tokens & lớp tiện ích Claymorphism trong `styles.css`

### Checkpoint 1: Foundation
- [ ] Font hiển thị đầy đủ dấu tiếng Việt khi chạy offline; `node --test tests/core.test.cjs` pass; không phát sinh request lỗi HTTP.

### Phase 2: Landing Shell & Core Learning Workspace
- [ ] **Task 3**: Nâng cấp Floating Claymorphism Navbar (kèm menu mobile) và Footer 5 cột (`index.html`, `styles.css`, `app.js`)
- [ ] **Task 4**: Triển khai Hero Section kèm Thẻ tiến độ học động & 3 badge SVG nổi (`app.js`, `styles.css`)
- [ ] **Task 5**: Triển khai mục Khóa học nổi bật (lưới 2×2) tích hợp Góc luyện tập theo bài & Hộp tạo đề kiểm tra (`app.js`, `styles.css`)

### Checkpoint 2: Core Landing & Existing Flows
- [ ] `node --test tests/core.test.cjs` và `python tests/browser_check.py` pass hoàn toàn (đủ 3 chế độ, resume, replace dialog, focus trap, QP1/QP2, 4 viewports).

### Phase 3: Full Landing Sections, App-Wide Polish & QA
- [ ] **Task 6**: Triển khai 3 section: Lợi ích (4 thẻ `.soft-clay`), Nhận xét học viên (3 thẻ `.clay-card`), và Lời mời đăng ký mục tiêu học tập (`app.js`, `styles.css`)
- [ ] **Task 7**: Đồng bộ giao diện Claymorphism cho Quiz, Result, History, Dialog + mở rộng kiểm thử `tests/browser_check.py` và chụp ảnh nghiệm thu (`styles.css`, `app.js`, `tests/browser_check.py`)

### Checkpoint 3: Complete
- [ ] Toàn bộ 10 unit tests (`core.test.cjs`) và toàn bộ Playwright browser checks (`browser_check.py`) pass trên cả `file://` và HTTP.
- [ ] Không tràn ngang ở `375px`, `768px`, `1024px`, `1440px` trên mọi màn hình.
- [ ] Ảnh chụp mới (`home-desktop.png`, `home-mobile.png`, `quiz-desktop.png`, `result-desktop.png`) khớp bảng màu, hình khối claymorphism, khoảng cách và độ tương phản chuẩn.

---

## Risks and Mitigations
| Risk | Impact | Mitigation |
| :--- | :--- | :--- |
| Gọi Google Fonts trực tuyến làm hỏng khả năng offline hoặc fail `all(status == 200)` trong `tests/browser_check.py` | High | Tải sẵn `.woff2` (`vietnamese` + `latin`) vào `assets/fonts/` và nạp bằng `@font-face` nội bộ. |
| Thay đổi cấu trúc DOM làm gãy selector trong `tests/browser_check.py` (ví dụ `.exam-panel h3`, `[data-course="qp2"]`, `[data-lesson="1"]`) | High | Giữ nguyên toàn bộ `data-*`, ID và văn bản `.exam-panel h3` là `"Kiểm tra kiến thức của bạn"`; chạy `browser_check.py` ở Checkpoint 2 & 3. |
| Floating navbar cố định che mất nội dung trên mobile hoặc khi cuộn đến anchor `#courses`/`#benefits` | Medium | Đặt `padding-top >= 116px` (mobile) / `136px` (desktop) cho hero/view đầu trang và `scroll-margin-top: 112px` cho các section mục tiêu. |
| Nút xanh lá `#22c55e` chữ trắng có độ tương phản thấp (`2.28:1`) theo chuẩn WCAG AA | Medium | Giữ `#22c55e` cho thanh tiến độ/viền/nhấn H1 cỡ lớn và dùng `#15803d` (`5.02:1`) cho nền `.btn-primary` có chữ trắng. |
| Các floating badge quanh thẻ tiến độ gây tràn ngang ở `375px` | Medium | Ẩn hoặc thu gọn badge trang trí dưới `1024px` và bọc `overflow-x: clip` an toàn mà không cản `position: sticky`. |

---

## Open Questions
1. **Nhận xét học viên (Testimonials)**: Dự án hiện chưa có dữ liệu đánh giá thật từ người dùng — kế hoạch dùng 3 nhận xét minh họa tiếng Việt tự nhiên (có ghi chú rõ là phản hồi sinh viên mẫu về QP1/QP2). Bạn có muốn dùng nhận xét mẫu này hay muốn cung cấp nội dung nhận xét riêng?
2. **Phần Lời mời đăng ký (Signup CTA)**: Vì ứng dụng chạy offline 100% không có server/tài khoản, bạn có đồng ý phương án biến form đăng ký thành **"Đặt tên & mục tiêu ôn tập mỗi ngày (lưu cục bộ trên trình duyệt)"** kèm nút bắt đầu học ngay không?
