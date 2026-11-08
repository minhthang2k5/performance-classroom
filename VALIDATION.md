# Kết quả kiểm tra bản local

## Chuẩn bị Render Free — 08/11/2026

- npm test: 14/14 PASS, bao gồm HTTP API và SQLite.
- npm run build: PASS.
- Mật khẩu admin theo yêu cầu được đặt trong .env bị Git ignore; xác nhận đăng nhập thành công bằng API.
- render.yaml: một web service Free, Node 24.21.0, build có devDependencies, HOST=0.0.0.0, HTTPS admin cookie và health check /api/health.
- Chưa deploy: môi trường chặn ghi Git metadata; tab Render đã mở ở màn hình đăng nhập, cần chủ tài khoản đăng nhập để tiếp tục.


## Cập nhật dữ liệu Newver — 08/11/2026

- Nguồn: bốn run trước tuning ngày 06/11 trong `Newver/eshop-sut/performance/k6/output/`. Stress sau tuning là thí nghiệm riêng.
- Smoke p95: 20,644 ms; Baseline steady p95: 4,675 ms, 7141 request/300s.
- Stress: 200–2000 VUs, hold 120s/bậc, 26 phút; bậc đầu vượt p95 500 ms là 600 VUs; 199/275 thresholds đạt.
- Spike: 50 → 800 → 50 VUs; đỉnh p95 10,476 ms; 75/75 thresholds đạt.
- Đã đối chiếu checksum summary/timeline, toàn bộ số đo phase và đánh giá từng threshold bằng số đo gốc: PASS (4/4 tests trong `server/test/measurements.test.mjs`).
- Chấm đủ 16 câu và hoàn tất phát lại toàn bộ cửa sổ mới: PASS. Hai câu lý thuyết/hai câu số liệu mỗi bài được giữ.
- Bảng số liệu bổ sung lỗi nghiệp vụ và PASS/FAIL của từng phase. Thiếu số đo vẫn hiển thị dấu gạch; skipped không tự làm bài fail.
- Chưa kiểm tra lại build, API Express hoặc giao diện trình duyệt: node_modules không còn, npm ci offline thiếu cache và npm ci trực tuyến gặp lỗi “Exit handler never called”. Các kết quả build/API ở các mục cũ bên dưới không xác nhận phiên bản dữ liệu này.


## Cập nhật bộ 16 câu hỏi — 08/11/2026

- Mỗi bài có 4 câu A/B/C/D: 2 lý thuyết, 2 số liệu; câu đầu hỏi định nghĩa kiểu test.
- Spike câu 4 dùng p50 khoảng 850 ms và p95 khoảng 5344 ms để hỏi về nhóm request chậm.
- `npm run build`: PASS.
- Bộ 10 test ứng dụng: 10/10 PASS khi dùng request/response trong cùng tiến trình, không mở kết nối TCP.
- Lệnh `npm test` với HTTP fixture mặc định bị môi trường chặn loopback (`connect EACCES`); chưa xác minh lại đường truyền HTTP trên host ở lượt cập nhật này.
- Đã render các component React để kiểm tra nhãn nút của cả 4 bài, 4 câu/16 radio mỗi bài, phân loại lý thuyết/số liệu, lời giải và điểm 4/4, tổng kết 16/16.
- Đã kiểm tra nhập lại dữ liệu giữ nguyên toàn bộ số đo/thresholds và tái tạo đúng bộ 16 câu.
- Đã loại bỏ ghi chú mô phỏng/phát lại ở trang tham gia, tổng quan và bài học.
- Chưa chạy lại kiểm tra trực quan trên trình duyệt cho phiên bản này.

## Ghi nhận kiểm tra trước lần cập nhật trên

Phần bên dưới là kết quả lưu từ phiên bản 3 câu mỗi bài (12 câu tổng cộng).

Ngày: 08/11/2026. Môi trường: Windows, Node.js 25.2.1, Chrome headless. Thư mục ứng dụng: `source/performance-classroom/`.

## Build và kiểm thử API/database

- `npm run build`: PASS, Vite tạo frontend production thành công.
- `npm test`: **10/10 test PASS**. Chạy trên host với quyền kết nối loopback; sandbox terminal của phiên làm việc chặn loopback nên lần chạy trong sandbox không kết nối được HTTP test server.
- Các bài kiểm tra dùng database riêng hoặc in-memory và đồng hồ có thể điều khiển; không dùng thời gian chờ thực để kiểm tra quy tắc API.

| Nhóm | Kết quả |
| --- | --- |
| Bốn bộ dữ liệu có nguồn/hash, 12 câu hỏi, mỗi câu A/B/C/D | PASS |
| Điểm tham chiếu và thresholds 2/2, 25/25, 201/252, 47/63 | PASS |
| Chấm một đáp án, từ chối thiếu/thừa/sai ID/chọn nhiều đáp án | PASS |
| Nhập tên có dấu, trùng tên, token riêng, bảo vệ API admin | PASS |
| Khóa bài sau, chờ hết mô phỏng, không lộ đáp án trước nộp | PASS |
| Chỉ mở số đo khi cửa sổ đo kết thúc, không tạo metric ramp | PASS |
| Nộp lại không nhân đôi, trả lời sai vẫn hoàn thành bài | PASS |
| Thứ hạng hoàn thành, hai lượt nộp gần đồng thời | PASS |
| Reset dữ liệu liên quan, token cũ hết hiệu lực, giữ admin | PASS |
| Database mở lại giữ tiến độ và thứ tự; giới hạn đăng nhập/origin | PASS |

## Luồng thực tế trên trình duyệt

Đã thao tác qua giao diện, không thay số đo hoặc bỏ qua thời lượng bài chính:

1. Nhập tên, mở Smoke, chạy 15 giây, reload khi đang chạy và tiếp tục được.
2. Mở đúng ba câu/12 radio, chọn câu trả lời, reload và khôi phục bản nháp.
3. Nộp Smoke, Baseline, Stress, Spike lần lượt theo thời lượng mặc định 15/30/60/30 giây.
4. Tổng kết hiển thị 12/12 câu đúng, đủ 4/4 bài, thứ tự hoàn thành #1.
5. Trong phiên trình duyệt độc lập, nhập tên khác và chạy Smoke; tiến độ riêng.
6. Admin đăng nhập, thấy hai người và các kết quả từng bài; người hoàn thành được xếp hạng.
7. Mở hộp reset, Escape để hủy; mở lại và xác nhận reset.
8. Bảng admin về 0 người; hai trình duyệt học viên cùng quay về nhập tên, token cũ đã được xóa. Phiên admin vẫn còn.

Không ghi nhận lỗi JavaScript `pageerror` trong luồng này. Dữ liệu học viên kiểm thử đã được reset khỏi database demo trước bàn giao.

## Giao diện và bản build

- Đã xem trực quan trang tham gia, bài học, câu hỏi và admin.
- Dashboard đã kiểm tra các độ rộng 375, 768, 1024, 1440 px: không tràn ngang toàn trang.
- Trang tham gia, bài học, câu hỏi và admin ở 375 px: không tràn ngang; bảng dữ liệu cuộn trong vùng bảng khi cần.
- Trong câu hỏi mobile, chọn đáp án khác vẫn chỉ có một radio được chọn trong cùng câu.
- Đã kiểm tra chế độ reduced-motion và đóng hộp reset bằng Escape.
- Đã chạy frontend production + Express trên một cổng thử riêng, dùng database QA riêng: tải trang và nhập tên thành công.
- Địa chỉ dev `http://localhost:5176` và API health đều trả lời thành công.

Chưa triển khai cloud, chưa kiểm thử tải của chính web lớp học hoặc kiểm tra screen reader đầy đủ. Đây là bản local để xem thử và dùng mô phỏng, không phải benchmark khả năng phục vụ đồng thời của web.
