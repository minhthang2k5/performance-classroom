# Kế hoạch triển khai local — Performance Classroom

Ngày lập: 08/11/2026. Cập nhật: đã triển khai đầy đủ bản local và kiểm tra hoạt động. Các mục dưới đây lưu quyết định thiết kế; hướng dẫn chạy thực tế tại `README.md`, kết quả kiểm tra tại `VALIDATION.md`.

## 1. Mục tiêu và phạm vi

Tạo một web mới phục vụ seminar: người học nhập tên, quan sát mô phỏng dựa trên kết quả đã lưu, trả lời câu hỏi sau mỗi bài; admin theo dõi tiến độ và thứ tự hoàn thành.

Các yêu cầu đã chốt:

- Có đúng bốn bài: Smoke, Baseline, Stress, Spike. Không có Soak.
- Web mới nằm tại `source/performance-classroom/`, cùng cấp với `source/test-web-performance/`.
- Không gọi k6, không phát tải tới EShop và không cần khởi động EShop.
- Server cung cấp dữ liệu có sẵn theo tiến trình để giao diện thể hiện quá trình mô phỏng.
- Sau khi một bài chạy xong, câu hỏi của bài đó xuất hiện bên dưới kết quả.
- Mỗi câu trắc nghiệm có đúng bốn lựa chọn A/B/C/D và một đáp án đúng; người học chỉ chọn một phương án.
- Người học chỉ nhập tên, không đăng ký tài khoản. Admin có mật khẩu riêng.
- Lưu tiến độ, câu trả lời và thứ tự hoàn thành trên server.
- Admin đơn giản, chỉ xem kết quả, bảng xếp hạng và reset danh sách người tham gia. Dùng một phiên demo chung, không quản lý nhiều phòng.
- Ưu tiên chạy local để người thực hiện xem thử trước khi quyết định đưa lên mạng.

Các lựa chọn mặc định dưới đây là đề xuất triển khai, có thể điều chỉnh sau khi xem bản local.

## 2. Công nghệ và cách chạy dự kiến

| Thành phần | Lựa chọn cho bản local | Mục đích |
| --- | --- | --- |
| Giao diện | React + Vite | Trang tham gia, bốn bài học, kết quả, câu hỏi và admin |
| Server | Node.js + Express | Quản lý phiên, tiến trình mô phỏng, chấm câu trả lời, lưu kết quả |
| Database | Một file SQLite tại `server/data/classroom.sqlite` | Không phải cài một dịch vụ database riêng |
| Nội dung bài học | JSON đã chuẩn hóa, có phiên bản | Lưu profile, kết quả, nguồn dữ liệu và câu hỏi |
| Cập nhật tiến trình | HTTP polling khoảng 1 giây/lần | Đơn giản, hỗ trợ tải lại trang; chưa cần WebSocket |
| Cập nhật admin | Polling khoảng 3 giây/lần | Xem tiến độ và thứ tự hoàn thành |

Địa chỉ dự kiến: frontend `http://localhost:5176`, API `http://localhost:4001`. Vite proxy `/api` sang API. Các cổng này tách khỏi web audit hiện tại.

Các lệnh chạy đã được cung cấp:

```powershell
cd source/performance-classroom
npm install
npm run dev
```

`npm run dev` khởi động frontend và API từ một terminal. Server tự tạo database/schema khi chưa có, không xóa dữ liệu mỗi lần chạy. Có `.env.example` để cấu hình cổng và mật khẩu admin; không đưa mật khẩu thật hoặc database bài làm lên Git.

Bản đầu dùng trên máy người trình bày. Khả năng cho bạn khác truy cập qua LAN được hướng dẫn riêng khi cần, phụ thuộc địa chỉ mạng và Windows Firewall.

## 3. Giao diện và luồng người học

| Trang | Nội dung và thao tác |
| --- | --- |
| Tham gia | Nhập tên hiển thị để vào phiên demo chung, không cần mã phòng |
| Tổng quan | Bốn thẻ bài học, mục tiêu từng bài, tiến độ 0/4 đến 4/4 |
| Bài học | Giới thiệu → profile tải → Chạy mô phỏng → kết quả → câu hỏi → giải thích |
| Hoàn thành | Kết quả bốn bài, số câu đúng và thứ tự hoàn thành của bản thân |
| Admin | Đăng nhập, xem kết quả, xếp hạng và reset danh sách người tham gia |

Luồng mặc định:

1. Server tự chuẩn bị một phiên demo chung; người học truy cập trực tiếp link web.
2. Người học nhập tên và nhận mã định danh tự động.
3. Làm lần lượt Smoke → Baseline → Stress → Spike.
4. Mỗi bài hiển thị mục tiêu, ngưỡng và hình dạng tải trước khi bắt đầu.
5. Bấm **Chạy mô phỏng**. Server lưu thời điểm bắt đầu và trả các mốc dữ liệu đến hạn.
6. Kết thúc mô phỏng, hiển thị kết quả đầy đủ rồi mở ba câu hỏi bên dưới; mỗi câu có bốn đáp án A/B/C/D.
7. Chọn một đáp án cho mỗi câu và nộp đủ ba câu trả lời, xem số câu đúng và giải thích; chuyển bài tiếp theo.
8. Nộp bài cuối, server ghi nhận hoàn thành cả bốn bài và thứ tự tương ứng.

Hiển thị rõ nhãn **Mô phỏng từ dữ liệu thực nghiệm đã lưu**. Bên cạnh biểu đồ luôn có tên run và phạm vi dữ liệu. Không trình bày như đang đo hệ thống thật.

## 4. Dữ liệu mô phỏng và tính đúng đắn

Nguồn chuẩn là các summary trong `evidence/k6/summaries/` ở thư mục gốc repository. Không lấy số liệu từ bảng bài tập đã lược bớt hoặc nhập lại bằng tay khi summary đã có metric tương ứng.

| Bài | Run mặc định | Thời gian hiển thị đề xuất | Nội dung chính |
| --- | --- | --- | --- |
| Smoke | `smoke-20261022-195537-4es3Xy` | Khoảng 15 giây | Một VU, một iteration, 5 requests, 10 checks |
| Baseline | `baseline-20261022-110446-eGLTX1` | Khoảng 30 giây | Ramp lên 50 VUs, steady 300 giây, giảm tải |
| Stress | `stress-20261022-181718-lx8F4c` | Khoảng 60 giây | 11 plateau từ 500 đến 2800 VUs và recovery |
| Spike | `spike-20261022-190641-UgVeF4` | Khoảng 30 giây | 50 → 1500 → 50 VUs, ba cửa sổ 30/60/60 giây |

Thời lượng mô phỏng chỉ giúp thao tác nhanh; giao diện vẫn ghi riêng thời lượng workload gốc. Bản đầu dùng các run trước tuning để minh họa baseline đạt, stress/spike có vấn đề và recovery. Các run tuned để dành cho chức năng so sánh ở giai đoạn sau.

Quy tắc xử lý dữ liệu:

- Viết bước nhập dữ liệu một lần để tạo JSON độc lập trong ứng dụng mới; lưu run ID, đường dẫn nguồn, hash summary và phiên bản bộ dữ liệu.
- Chuẩn hóa p50/p95/p99, HTTP lỗi, checks, requests và thresholds từ summary. Kiểm tra cấu trúc metric phẳng/nested; không đoán giá trị thiếu.
- Baseline lấy các metric của `phase:steady`. Stress/spike giữ đúng từng plateau/recovery và metric per-API.
- RPS của phase bằng số request chia thời lượng phase gốc, không chia thời gian demo đã tua nhanh.
- Không tính p95 tổng bằng trung bình các p95. Không cộng nhầm số checks thành số request.
- Smoke không có chuỗi số liệu theo thời gian: phát tiến trình theo bước để minh họa, công bố số đo tổng ở cuối bài; không bịa latency cho từng request.
- Baseline không có đủ metric ramp thì chỉ thể hiện profile VUs và trạng thái ramp; không tự điền p95/RPS của ramp.
- Stress/spike biểu diễn số đo theo từng phase. Điểm p95 là tổng hợp của phase, không phải số đo mỗi giây. Không nối/nội suy thành đường telemetry thực.
- Profile VUs là **tải mục tiêu**, không khẳng định đó là số VUs đang hoạt động được đo tại từng thời điểm.
- Tách kết luận toàn bài khỏi trạng thái từng phase/API. Chỉ tiêu rút gọn cho bài học được ghi riêng với bộ thresholds gốc.
- Khi đọc summary phẳng hiện có, lưu ý boolean threshold `true` thể hiện vi phạm. Parser phải chuẩn hóa và đối chiếu với PASS/FAIL tham chiếu, không suy cùng ý nghĩa cho mọi schema.

Các mốc đối chiếu để kiểm tra parser: smoke đủ 5 requests/10 checks; baseline steady 5925 requests, p95 khoảng 8.122 ms; stress có phase đầu vi phạm tại 1500 VUs; spike đỉnh p95 khoảng 5344.455 ms, HTTP lỗi khoảng 1.486%.

## 5. Câu hỏi, chấm điểm và hoàn thành

Mỗi bài có ba câu trắc nghiệm, tổng cộng 12 câu. **Mỗi câu có đúng bốn đáp án A/B/C/D, chỉ một đáp án đúng**, hiển thị bằng nhóm radio để chỉ chọn được một phương án. Dùng câu hỏi mẫu có tham số lấy từ JSON của đúng bài; không cần kết nối AI để sinh câu hỏi trong bản đầu.

| Bài | Ba trọng tâm câu hỏi |
| --- | --- |
| Smoke | Requests khác checks; đọc kết quả smoke; giới hạn của smoke pass |
| Baseline | Ý nghĩa p95; đối chiếu ngưỡng steady; API có p95 cao nhất trong phạm vi đang xét |
| Stress | Bậc đầu vi phạm; RPS tăng không tự bảo đảm SLO; đọc recovery |
| Spike | So sánh nền/đỉnh; đánh giá độ trễ và lỗi; đọc kết quả sau giảm tải |

- Chỉ lấy câu hỏi đòi hỏi metric mà bộ dữ liệu thực sự cung cấp.
- Mỗi câu lưu ID, nội dung, bốn lựa chọn có ID A/B/C/D, ID đáp án đúng và giải thích. Ba phương án sai phải hợp lý, không trùng lặp và không tạo ra thêm đáp án đúng.
- Server kiểm tra mỗi câu có đúng bốn lựa chọn, đúng một đáp án chuẩn và người học gửi đúng một ID thuộc A/B/C/D. Không có câu tự luận hoặc câu chọn nhiều đáp án trong bản local.
- Đáp án và giải thích do server giữ, chỉ trả về sau khi nộp; không để trong JSON công khai cùng câu hỏi.
- Server xác nhận bài mô phỏng đã kết thúc và người học đã trả lời đủ trước khi nhận bài nộp.
- **Hoàn thành một bài** = chạy hết mô phỏng + nộp đủ câu trả lời, không bắt buộc trả lời đúng cả ba.
- **Hoàn thành buổi học** = hoàn thành đủ bốn bài trong phiên demo hiện tại.
- Điểm đúng/sai và thứ tự hoàn thành là hai thông tin riêng. Đây là công cụ thực hành, không phải hệ thống thi có xác minh danh tính.
- Lưu lượt nộp đầu tiên để ghi điểm và tiến độ. Bấm nộp lại do lỗi mạng không tạo thêm bản ghi hoặc đổi thời điểm hoàn thành.
- Có thể xem lại mô phỏng/giải thích sau khi hoàn thành; việc xem lại không thay đổi thứ tự đã ghi.

## 6. Lưu trữ và phiên tham gia

| Nhóm bảng | Dữ liệu chính |
| --- | --- |
| `demo_state` | Một bản ghi cấu hình phiên demo hiện tại, số phiên tăng sau reset, bộ dữ liệu đang dùng |
| `participants` | ID, số phiên demo, tên hiển thị, hash token phiên, thời điểm tham gia, completedAt, completionOrder |
| `lesson_attempts` | Participant ID, loại bài, datasetVersion, startedAt, thời lượng mô phỏng, trạng thái |
| `quiz_submissions` | Attempt ID, câu trả lời, số câu đúng, submittedAt |
| `admin_sessions` | Phiên admin có hạn dùng, tách khỏi phiên người học |

- Tên được trim, giới hạn độ dài và hiển thị như text; hai người trùng tên vẫn có ID khác nhau.
- Trình duyệt giữ token ngẫu nhiên riêng của người học để khôi phục phiên trên cùng trình duyệt; server lưu hash token. Không dùng tên làm bằng chứng sở hữu bài làm.
- Trang tải lại lấy tiến trình từ server. API tính mốc được phát theo thời điểm bắt đầu đã lưu; không phụ thuộc bộ đếm trên một tab.
- Không có hàng đợi chạy k6: mỗi người có tiến trình phát dữ liệu độc lập; không tạo tải thật nên có thể mô phỏng đồng thời.
- Cập nhật bài nộp và tiến độ trong transaction. Lượt hoàn thành thứ tư chỉ được ghi một lần.
- `completedAt` do server tạo theo UTC, giao diện hiển thị giờ Việt Nam. `completionOrder` được cấp tăng dần trong phiên demo hiện tại trong cùng transaction, xử lý cả hai lượt nộp gần đồng thời.
- Thứ tự hoàn thành dựa trên lượt hoàn tất mà server ghi nhận, không dùng đồng hồ client hoặc thứ tự response đến trình duyệt admin.
- UNIQUE cho một lượt bài chính thức trên mỗi người/mỗi bài và một bài nộp trên mỗi attempt để chống nhấp đúp.
- Dữ liệu tồn tại sau khi tắt/mở server. Chỉ thao tác reset rõ ràng của admin mới xóa dữ liệu người tham gia để bắt đầu buổi mới.
- Reset thực hiện trong transaction: xóa người tham gia, attempts và bài nộp hiện tại; tăng số phiên demo, đưa bộ đếm hoàn thành về đầu. Giữ nội dung bốn bài, câu hỏi, cấu hình và phiên đăng nhập admin.
- Token người học của phiên cũ không còn hợp lệ sau reset; người đang mở web được thông báo phiên đã reset và quay về trang nhập tên. Request của phiên cũ, kể cả request đang chờ, không được ghi dữ liệu vào phiên mới.

## 7. Trang admin

Admin đăng nhập bằng mật khẩu cấu hình local. API bảo vệ các thao tác quản trị bằng phiên admin; không chỉ ẩn nút trên giao diện.

Trang admin chỉ có một màn hình với ba chức năng:

1. **Xem kết quả:** tổng số người tham gia, số người đã hoàn thành và bảng tên, tiến độ 0–4/4, số câu đúng từng bài/tổng 0–12, thời điểm hoàn thành.
2. **Xếp hạng:** người hoàn thành cả bốn bài được xếp theo thứ tự hoàn thành mà server ghi nhận; ai hoàn thành trước đứng trước. Người chưa hoàn thành không có hạng, nằm trong danh sách đang làm. Điểm hiển thị riêng, không dùng để đổi thứ tự này.
3. **Reset người tham gia:** nút reset đưa số người tham gia và số người hoàn thành về 0, xóa danh sách, bài làm và thứ hạng hiện tại, bắt đầu lại thứ tự từ 1 cho phiên mới.

Trước reset, hiển thị xác nhận nêu rõ danh sách, bài làm và thứ hạng hiện tại sẽ bị xóa. Reset không xóa nội dung bài học/câu hỏi và không đăng xuất admin. Đây là reset dữ liệu thật của phiên, không chỉ đổi con số hiển thị về 0.

Không làm giao diện quản lý phòng, mở/đóng phòng, trang chi tiết từng người hoặc xuất CSV trong bản local. Mỗi người học xem kết quả bản thân; admin xem bảng tổng hợp toàn bộ.

## 8. API và cấu trúc mã nguồn dự kiến

Các nhóm API:

- Tham gia/khôi phục: thông tin phiên demo chung, tạo phiên từ tên, lấy tiến độ bản thân.
- Bài học: danh sách bài, bắt đầu/tiếp tục attempt, lấy mốc mô phỏng, lấy câu hỏi khi đủ điều kiện, nộp và nhận giải thích.
- Admin: đăng nhập/đăng xuất, lấy bảng kết quả/xếp hạng và reset toàn bộ người tham gia của phiên hiện tại.

API xác định người học từ token; không cho chọn tùy ý participant ID để đọc/sửa bài người khác. Cấu hình cookie/token và rate limit đơn giản cho đăng nhập, tạo phiên và nộp bài; phiên admin và phiên học viên độc lập để có thể thử trên cùng máy.

| Đường dẫn dự kiến | Nội dung |
| --- | --- |
| `frontend/src/` | Trang React, thành phần biểu đồ, câu hỏi, admin, API client |
| `server/src/` | Express, xác thực phiên, mô phỏng, chấm bài, quản trị |
| `server/src/storage/` | Schema và các hàm truy cập SQLite |
| `server/content/` | Dữ liệu chuẩn hóa, metadata nguồn, câu hỏi/đáp án phía server |
| `server/data/` | Database runtime, được Git ignore |
| `scripts/` | Nhập summary và kiểm tra dữ liệu nguồn |
| `.env.example` | Cấu hình mẫu không chứa bí mật |
| `README.md` | Cách chạy và kịch bản demo local |

## 9. Thứ tự triển khai và đầu ra xem thử

| Bước | Công việc | Tiêu chí xong |
| --- | --- | --- |
| 1 | Dựng project mới, kết nối React/Express/SQLite | Một lệnh khởi động; API health; database tự tạo; không tác động web audit |
| 2 | Chuẩn hóa bốn bộ dữ liệu và 12 câu hỏi | Mỗi câu đúng bốn đáp án A/B/C/D, một đáp án đúng; mapping nguồn rõ, các mốc tham chiếu đúng |
| 3 | Làm trọn một bài Smoke | Nhập tên → mô phỏng → kết quả → nộp câu hỏi → lưu tiến độ |
| 4 | Hoàn thiện Baseline, Stress, Spike | Đủ bốn bài, biểu đồ theo phase, giải thích đúng phạm vi số liệu |
| 5 | Làm admin: kết quả, xếp hạng, reset | Hai người có dữ liệu riêng, thứ tự đúng; reset đưa danh sách về rỗng và số người về 0 |
| 6 | Kiểm tra và hoàn thiện demo | Reload/restart giữ dữ liệu; lỗi mạng không nhân đôi bài nộp; giao diện rõ trên laptop |

Hoàn tất sáu bước mới coi là bản local đầy đủ. Sau bước 3 đã có một luồng Smoke để xem trước giao diện và cách giảng giải; tiếp tục hoàn thiện các bước còn lại trong phạm vi đã được yêu cầu khi triển khai.

## 10. Kiểm tra nghiệm thu

Chỉ viết kiểm thử cho các quy tắc dữ liệu và lưu bài quan trọng, không kiểm thử lặp lại từng dòng giao diện:

- Bộ nhập dữ liệu đọc đúng summary, RPS phase, tỷ lệ lỗi/checks và trạng thái thresholds; phát hiện thiếu metric.
- Đủ 12 câu; mỗi câu có đúng bốn lựa chọn A/B/C/D và một đáp án chuẩn. UI chỉ chọn được một phương án; API từ chối ID không hợp lệ hoặc nhiều đáp án cho một câu.
- Server không nhận bài nộp khi mô phỏng chưa kết thúc, thiếu câu trả lời hoặc cố nộp bài chưa mở khóa.
- Hai lần gửi cùng bài nộp chỉ lưu một kết quả; hoàn thành bài thứ tư chỉ cấp một thứ tự.
- Hai người hoàn thành gần đồng thời được cấp thứ tự riêng, ổn định sau reload/restart.
- Token người A không xem được bài người B; người chưa đăng nhập admin không đọc bảng tổng hợp hoặc gọi reset.
- Reset xóa người tham gia, attempts, bài nộp và thứ hạng trong một transaction; giữ bài học và tài khoản/phiên admin. Token cũ không thể tiếp tục nộp; người mới được xếp hạng từ 1.
- Dùng hai trình duyệt/phiên riêng để kiểm tra nhập trùng tên, tiến độ độc lập và cập nhật admin.
- Kiểm tra trực quan các trạng thái chờ, lỗi, đang mô phỏng, kết thúc, câu hỏi và giải thích; build frontend thành công.

Kịch bản người dùng tự xem thử: mở admin → mở hai phiên học viên → nhập hai tên → làm câu hỏi bốn lựa chọn ở cả bốn bài → đối chiếu kết quả và xếp hạng admin → tắt/mở server và xác nhận dữ liệu vẫn còn → reset và xác nhận danh sách rỗng, số người bằng 0 → nhập tên mới để bắt đầu lại.

## 11. Chuẩn bị cho việc đưa lên mạng sau này

Bản local không cần tài khoản Render/Supabase. Tách các thao tác lưu dữ liệu thành lớp storage ngay từ đầu để có thể thay SQLite bằng PostgreSQL sau này; vẫn cần migration schema, sửa truy vấn khác cú pháp và kiểm tra transaction/concurrency, không hứa chỉ đổi connection string là xong.

Khi quyết định deploy mới bổ sung PostgreSQL/Supabase, biến môi trường production, HTTPS/cookie tương ứng và cấu hình Render phục vụ frontend build. Dữ liệu mô phỏng vẫn đi kèm source, còn tên/bài làm/thứ tự hoàn thành nằm trong database bền vững. Có bước chuyển dữ liệu local nếu người dùng muốn giữ lịch sử.

Các phần để sau bản local: so sánh trước/sau tuning, tự nhập bộ dữ liệu mới, phòng trình chiếu đồng bộ toàn lớp, chấm tự luận bằng AI và bảng xếp hạng công khai.
