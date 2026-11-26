# QP Study — Ôn tập QP1 & QP2

**Truy cập web:** https://huydhb.github.io/QPStudy/

GitHub Pages xuất bản từ nhánh `main`, thư mục gốc. Đẩy thay đổi lên `main` sẽ tự cập nhật website.

Mở **index.html** bằng Edge, Chrome hoặc Firefox. Giữ nguyên thư mục `data`, `assets`, các file CSS và JavaScript bên cạnh HTML. Không cần cài đặt, mạng, tài khoản hoặc máy chủ. Có thể đưa toàn bộ thư mục lên hosting tĩnh.

## Cách sử dụng

- Chọn QP1 hoặc QP2, bấm một bài để luyện đủ 20 câu. Chọn chế độ trả lời, đảo thứ tự và thời gian nếu muốn.
- Tạo đề kiểm tra: chọn bài, nhập số câu (mặc định 50, giới hạn theo ngân hàng đã chọn), đặt thời gian (mặc định 30 phút) hoặc không giới hạn. Các bài được lấy số câu gần bằng nhau, rồi trộn câu; không đảo A–D.
- Chế độ **chọn đến khi đúng** cho thử lại; tỷ lệ/điểm đánh giá lần chọn đầu, số hoàn thành ghi riêng. **Hiện kết quả ngay** khóa sau một lựa chọn. **Kết quả cuối bài** cho sửa đáp án, chỉ chấm khi nộp.
- Dùng bảng câu để chuyển câu, đánh dấu để xem lại. Nộp bài để xem điểm, đáp án, kết quả từng bài và luyện lại câu sai/bỏ trống. Có thể ôn riêng câu chưa đúng lần đầu trong chế độ thử lại.
- Về góc học tập để tạm rời phiên. Bấm **Tiếp tục làm bài** để quay lại. Đồng hồ vẫn chạy khi đóng trang; quá hạn sẽ tự nộp khi mở lại. Chỉ một phiên được lưu; tạo lượt mới sẽ hỏi trước khi thay phiên cũ.

## Dữ liệu và lưu trữ

Đúng 340 câu từ `AZOTA_GIAO_TRINH_QP1_200_CAU_CO_DAP_AN.docx` và `AZOTA_GIAO_TRINH_QP2_140_CAU_CO_DAP_AN.docx` trong thư mục `Câu hỏi Giáo Trình`. QP1 có bài 2–11, bài 1 hiển thị chưa có dữ liệu. QP2 có bài 1–7. Mỗi bài có 20 câu. Đáp án tô nổi đã được đối chiếu với bảng đáp án cuối tài liệu. Không bổ sung lời giải.

Cấu hình, phiên đang làm và 50 kết quả gần nhất lưu trong localStorage của trình duyệt. Không đồng bộ thiết bị. Xóa dữ liệu trình duyệt sẽ xóa lịch sử. Trình duyệt có thể quản lý dữ liệu riêng cho file HTML; nên giữ nguyên vị trí thư mục, dùng cùng trình duyệt và chỉ một tab đang làm bài. Khi chuyển sang hosting, lịch sử cục bộ không tự chuyển sang địa chỉ mới. Nếu không lưu được, web báo và vẫn cho làm bài trong phiên hiện tại.

## Cấu trúc và kiểm tra

- `data/questions.js`: ngân hàng câu hỏi, nạp bằng script để dùng được với file HTML trực tiếp.
- `core.js`: tạo đề, phiên làm bài, chấm điểm và lưu trữ.
- `app.js`, `styles.css`: giao diện và tương tác.
- `tools/extract_questions.py`: trích xuất bằng thư viện chuẩn Python, xác minh đủ câu, A–D, phân bài và đáp án. Chạy từ bất kỳ thư mục nào: `python tools/extract_questions.py` (đường dẫn tương đối từ Web-QP). Cần giữ hai file nguồn tại vị trí hiện có.
- `tests/core.test.cjs`: chạy `node --test tests/core.test.cjs` trong thư mục Web-QP.
- `tests/browser_check.py`: kiểm tra tự động giao diện bằng Python Playwright và Chromium; chạy `python tests/browser_check.py`. Ảnh chụp kiểm tra lưu trong `tests/artifacts/`.

Để kiểm tra qua HTTP: chạy `python -m http.server 8080` trong thư mục Web-QP rồi mở `http://localhost:8080`. Tất cả tài nguyên phục vụ giao diện đều cục bộ.
