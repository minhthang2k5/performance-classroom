# Performance Lab — Phòng thực hành kiểm thử hiệu năng

Web độc lập để học qua bốn bài **Smoke, Baseline, Stress, Spike**. Server phát lại dữ liệu thực nghiệm đã lưu, không chạy k6 và không gửi tải tới EShop. Mỗi bài có bốn câu trắc nghiệm (hai câu lý thuyết và hai câu số liệu), mỗi câu bốn lựa chọn A/B/C/D và một đáp án đúng.

## Chạy local

Cần Node.js từ **22.13.0** trở lên và npm. Máy hiện tại đã được kiểm tra với Node.js 25.2.1. SQLite dùng module `node:sqlite` có sẵn, không cần cài database server. Trên các bản Node còn đánh dấu module này experimental có thể thấy cảnh báo lúc khởi động; database vẫn hoạt động.

Tại thư mục này:

```powershell
npm install
npm run dev
```

- Web: **http://localhost:5176**
- Admin: **http://localhost:5176/#/admin**
- API: `http://localhost:4001/api/health`

Một terminal khởi động cả frontend và API. `Ctrl+C` để dừng. Không cần mở EShop, web audit, k6, Docker hoặc Supabase.

### Mật khẩu admin

Lần chạy đầu tự tạo một mật khẩu local ngẫu nhiên. Xem bằng lệnh:

```powershell
npm run admin:password
```

Mật khẩu được giữ trong `server/data/local-admin.txt` và không đổi khi khởi động lại. Có thể tạo `.env` từ `.env.example` rồi đặt `ADMIN_PASSWORD` riêng (ít nhất 8 ký tự). Nếu dùng `.env`, lệnh trên hiển thị đúng mật khẩu đang cấu hình.

### Chạy bản build trên một cổng

Dừng `npm run dev` trước bằng `Ctrl+C` để giải phóng cổng API.

```powershell
npm run build
npm start
```

Mở **http://localhost:4001**; admin tại `http://localhost:4001/#/admin`. Express phục vụ cả frontend build và API. `npm run dev` vẫn dùng cổng 5176 cho giao diện đang phát triển.

## Thử luồng đầy đủ

1. Mở web và nhập tên (2–50 ký tự). Không cần đăng ký tài khoản.
2. Chọn Smoke, đọc mục tiêu và bấm **Chạy Smoke test**.
3. Khi kết thúc, xem số đo, bảng số liệu/thresholds và bốn câu hỏi bên dưới.
4. Chọn một đáp án cho mỗi câu, nộp bài để xem giải thích và mở bài tiếp theo.
5. Làm tiếp Baseline, Stress, Spike. Đủ bốn bài sẽ có tổng kết và thứ tự hoàn thành.
6. Mở một trình duyệt khác hoặc cửa sổ ẩn danh, nhập một tên khác để mô phỏng người thứ hai. Hai tab cùng trình duyệt dùng chung phiên người học.
7. Vào trang admin, đăng nhập để xem kết quả và thứ hạng. Bảng tự cập nhật khoảng 3 giây/lần.

Thời lượng trình diễn mặc định: Smoke 7,5s, Baseline 15s, Stress 40s, Spike 15s. Profile thực nghiệm được hiển thị cùng thời lượng quan sát của bài học. Không cần đợi 26 phút để xem Stress.

**Hoàn thành** = xem hết mô phỏng + nộp đủ bốn câu của mỗi bài, không bắt buộc đúng cả bốn. **Thứ hạng** = ai hoàn thành cả bốn bài được server ghi nhận trước thì đứng trước; điểm 0–16 hiển thị riêng, không dùng để đổi thứ hạng. Lượt nộp đầu tiên được giữ; nhấp đúp không tạo thêm kết quả.

## Admin đơn giản

- Xem tên, tiến độ từng bài, điểm từng bài/tổng và giờ hoàn thành (giờ Việt Nam).
- Xem xếp hạng theo thứ tự hoàn thành bốn bài.
- **Reset người tham gia**: xác nhận để xóa toàn bộ tên, bài làm và thứ hạng hiện tại; số người về 0. Nội dung bài và mật khẩu/phiên admin vẫn được giữ. Học viên đang mở web được đưa về nhập tên lại.

Không có quản lý nhiều phòng, trang chi tiết từng người hoặc xuất CSV.

## Lưu dữ liệu

- `server/data/classroom.sqlite`: người tham gia, tiến trình, câu trả lời và thứ hạng.
- Dữ liệu không mất khi reload trang hoặc khởi động lại server. Server không tự reset database.
- Trình duyệt giữ token người học để khôi phục phiên. Admin dùng cookie HttpOnly riêng; không dùng tên làm khóa định danh.
- Toàn bộ `server/data/`, `.env`, `node_modules/` và build đã được Git ignore.

## Nguồn số liệu và giới hạn mô phỏng

`server/content/*.json` được tạo từ bốn summary gốc trong `../../Newver/eshop-sut/performance/k6/output/`; mỗi bài lưu run ID và SHA-256 của summary, cùng checksum timeline nếu có. Lịch tải được lấy từ `measurement-timeline.json` của đúng run. Bộ 16 câu hỏi được tạo từ `server/src/questions.mjs`; nhập lại dữ liệu cũng giữ cùng nội dung câu hỏi. Đây là kết quả trước tuning, không phải dữ liệu phát sinh bởi phiên học viên.

| Bài | Nguồn | Thresholds gốc |
| --- | --- | --- |
| Smoke | `smoke-20261106-201703-cVgZoy` | 2/2 đạt |
| Baseline | `baseline-20261106-180216-cXQggA` | 25/25 đạt |
| Stress | `stress-20261106-185434-JpCHYG` | 199/275 đạt |
| Spike | `spike-20261106-182250-CyyDmN` | 75/75 đạt |

- VUs là profile **mục tiêu**. Mốc tiến trình minh họa thứ tự quan sát, không phải log mạng đang phát trực tiếp.
- Các cột p95 là tổng hợp từng cửa sổ đo. Không tạo chuỗi latency giả theo từng giây.
- Baseline chỉ có số đo steady; các đoạn ramp chỉ minh họa cấu hình tải.
- Smoke chỉ công bố số đo tổng khi kết thúc, không tự dựng latency từng API.
- RPS phase = requests / số giây gốc của phase; không chia theo thời gian trình diễn. Baseline steady: 300s; Stress hold: 120s; Spike peak: 60s; recovery: 60s.
- Thiếu số đo thì hiển thị `—`; p99 Smoke không có trong nguồn nên không tự tạo.
- Stress dùng lịch 200–2000 VUs (26 phút), không phải run sau tuning; Spike dùng 50 → 800 → 50 VUs và đạt 75/75 thresholds.
- PASS/FAIL của mỗi phase xét toàn bộ thresholds tổng/từng API và nghiệp vụ. Skipped chỉ là chỉ số chẩn đoán, không tự làm phase FAIL.
- Cột Nghiệp vụ lỗi dùng `business_operations_failed`; không đồng nhất tỷ lệ lỗi nghiệp vụ với HTTP lỗi hoặc checks. Smoke không có metric này nên hiển thị `—`.
- PASS/FAIL thresholds của run khác với điểm câu hỏi của người học. Phục hồi đạt không xóa vi phạm tại đỉnh tải.

Chỉ chạy lại bước nhập dữ liệu nếu còn thư mục nguồn và cần tái tạo:

```powershell
npm run import:data
```

Web chạy bình thường từ `server/content/`, không cần giữ EShop hoặc source k6 bên cạnh khi mang ứng dụng sang máy khác. Không thay nội dung/đáp án giữa một buổi học đang diễn ra; reset người tham gia trước khi dùng bộ dữ liệu mới.

## Kiểm tra

```powershell
npm test
npm run build
```

Integration tests dùng database tạm và đồng hồ có thể điều khiển, kiểm tra khóa bài/câu hỏi, đáp án, idempotency, xếp hạng, reset, phiên admin và khởi động lại. Không sửa dữ liệu lớp thật.

## Cho bạn khác xem qua LAN

Tạo `.env` từ `.env.example`, đặt `HOST=0.0.0.0`, khởi động lại. Trên cùng mạng, mở `http://<IPv4-máy-chạy-web>:5176`. Nếu dùng bản build thì mở cổng 4001. Windows Firewall phải cho phép cổng tương ứng; ứng dụng không tự sửa firewall. Chỉ cần công khai cổng frontend khi chạy dev vì API đi qua proxy.

## Đưa lên mạng sau này

Có thể đưa riêng nội dung folder `performance-classroom` lên một repository GitHub mới và dùng `render.yaml` trong folder để triển khai Render Free. Root Directory để trống. Xem [hướng dẫn Render](RENDER_DEPLOY.md). Bản này dùng SQLite; danh sách và điểm được giữ trong lúc dịch vụ hoạt động, nhưng sẽ mất qua restart/deploy/sleep của Render Free.

Hướng thiết kế dựa trên UI/UX Pro Max: dashboard sáng, SVG, biểu đồ có bảng dữ liệu tương đương, radio có label/fieldset, focus bàn phím, reduced-motion và bố cục responsive. Quyết định cụ thể tại `design-system/MASTER.md`.
