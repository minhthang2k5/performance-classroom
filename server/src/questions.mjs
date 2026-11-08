const number = value => new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 3 }).format(value);
const question = (id, category, prompt, choices, correct, explanation) => ({
  id, category, prompt, choices: choices.map((text, index) => ({ id: 'ABCD'[index], text })), correct, explanation
});

export function buildQuestions(lesson) {
  const q = (suffix, category, ...args) => question(`${lesson.id}-${suffix}`, category, ...args);
  const phase = lesson.phases.find(item => item.key === lesson.representative);
  if (lesson.id === 'smoke') return [
    q(1, 'theory', 'Smoke test là gì?', [
      'Kiểm thử duy trì tải trong thời gian dài để tìm sự suy giảm theo thời gian.',
      'Kiểm thử ngắn với tải rất nhỏ để kiểm tra luồng chính và các điều kiện hoạt động cơ bản.',
      'Kiểm thử tăng tải vượt mức bình thường để tìm dấu hiệu suy giảm.',
      'Kiểm thử phản ứng của hệ thống khi tải tăng đột ngột.'
    ], 'B', 'Smoke test kiểm tra script, kết nối và luồng API cơ bản với tải nhỏ trước khi tiến hành các bài tạo tải lớn.'),
    q(2, 'theory', 'Vì sao cần chạy Smoke test trước khi chạy bài kiểm thử có tải lớn?', [
      'Để xác định ngay số người dùng tối đa mà hệ thống chịu được.',
      'Để thay thế toàn bộ các bài Baseline, Stress và Spike.',
      'Để phát hiện sớm lỗi script, cấu hình hoặc luồng API trước khi tốn tài nguyên tạo tải lớn.',
      'Để thu đủ số mẫu chứng minh hệ thống ổn định trong nhiều giờ.'
    ], 'C', 'Nếu script dùng sai endpoint, thiếu token hoặc sai checkpoint, kết quả tạo tải lớn sẽ không phản ánh đúng luồng cần kiểm thử. Smoke giúp phát hiện sớm các vấn đề này.'),
    q(3, 'data', `Kết quả có ${lesson.overall.requests} HTTP requests và ${lesson.overall.checksPassed + lesson.overall.checksFailed} checks. Vì sao số checks nhiều hơn số requests?`, [
      'Mỗi check được tính là một HTTP request riêng.',
      'Mỗi response trong bài được kiểm tra hai điều kiện.',
      'Mỗi người dùng ảo luôn gửi đúng hai request.',
      'Các request lỗi luôn tự động được đếm hai lần.'
    ], 'B', 'Mỗi response trong bài có hai check: status và nội dung. Vì vậy 5 HTTP requests tương ứng 10 checks; check không phải là một request mới.'),
    q(4, 'data', `Lần chạy có ${lesson.peakVus} VU, ${lesson.overall.requests} requests, ${lesson.overall.checksPassed}/${lesson.overall.checksPassed + lesson.overall.checksFailed} checks đạt, p95 khoảng ${number(phase.metrics.p95)} ms, dưới ngưỡng 500 ms. Quyết định tiếp theo nào phù hợp nhất?`, [
      'Kết luận hệ thống đáp ứng tốt ở mọi mức tải lớn.',
      'Tiếp tục chạy Baseline để đánh giá hiệu năng ở tải bình thường vì các điều kiện Smoke đã đạt.',
      'Bỏ qua các bài kiểm thử khác vì không xuất hiện lỗi.',
      'Dùng p95 của Smoke làm kết quả đại diện cho mọi mức tải.'
    ], 'B', 'Kết quả xác nhận các điều kiện cơ bản đã đạt trong lần chạy nhỏ này, đủ cơ sở để tiếp tục kiểm thử ở mức tải cao hơn.')
  ];
  if (lesson.id === 'baseline') return [
    q(1, 'theory', 'Baseline test là gì?', [
      'Bài kiểm thử thiết lập bộ số liệu nền ở điều kiện tải xác định, làm mốc so sánh cho các lần chạy sau.',
      'Bài kiểm thử chỉ xác nhận một luồng API có chạy được hay không.',
      'Bài kiểm thử tạo tải tăng đột ngột để quan sát phản ứng tức thời.',
      'Bài kiểm thử luôn phải đẩy hệ thống đến khi ngừng phục vụ.'
    ], 'A', 'Baseline là mốc so sánh có ghi rõ workload, dữ liệu và môi trường. Trong bài này, nhóm quan sát tải bình thường ở mức 50 VUs.'),
    q(2, 'theory', 'Vì sao nên quan sát cửa sổ tải ổn định (steady) khi thiết lập số liệu nền?', [
      'Vì trong cửa sổ steady mọi request bắt buộc có cùng thời gian phản hồi.',
      'Vì chỉ cần xem số VUs, không cần quan sát độ trễ hay tỷ lệ lỗi.',
      'Vì mức tải được giữ ổn định, giúp đánh giá và so sánh kết quả ở cùng điều kiện tải rõ ràng hơn.',
      'Vì steady loại bỏ toàn bộ request lỗi khỏi thống kê.'
    ], 'C', 'Cửa sổ steady giữ mức tải mục tiêu ổn định, tránh gộp lẫn tác động của tăng tải và giảm tải vào mốc so sánh. Vẫn cần giữ và đánh giá mọi request, kể cả request lỗi.'),
    q(3, 'data', `Tại ${phase.vus} VUs, cửa sổ steady có p95 khoảng ${number(phase.metrics.p95)} ms. Con số này diễn tả điều gì?`, [
      'Khoảng 95% request trong cửa sổ steady có thời gian phản hồi không vượt mốc này.',
      'Thời gian phản hồi trung bình của tất cả request là mốc này.',
      '95% người dùng đã hoàn thành đăng nhập.',
      'Hệ thống xử lý được 95 request mỗi giây.'
    ], 'A', 'p95 là phân vị thứ 95 của thời gian phản hồi trong tập request được đo. Nó không phải số trung bình, tỷ lệ đăng nhập hay RPS.'),
    q(4, 'data', 'Quan sát p95 của Search, Detail, Cart và Checkout trong cửa sổ steady. API nào có p95 cao nhất và khoảng bao nhiêu?', [
      `Search, khoảng ${number(phase.endpoints.find(item => item.endpoint === 'search').p95)} ms.`,
      `Detail, khoảng ${number(phase.endpoints.find(item => item.endpoint === 'detail').p95)} ms.`,
      `Cart, khoảng ${number(phase.endpoints.find(item => item.endpoint === 'cart').p95)} ms.`,
      `Checkout, khoảng ${number(phase.endpoints.find(item => item.endpoint === 'checkout').p95)} ms.`
    ], 'D', `Checkout có p95 khoảng ${number(phase.endpoints.find(item => item.endpoint === 'checkout').p95)} ms, cao nhất trong bốn API nghiệp vụ ở cửa sổ steady. Cần đọc số đo từng API bên cạnh số tổng hợp.`)
  ];
  if (lesson.id === 'stress') {
    const holds = lesson.phases.filter(item => item.key.startsWith('hold_'));
    const firstSlow = holds.find(item => item.metrics.p95 > 500);
    if (!firstSlow) throw new Error('Stress questions require a measured plateau above 500 ms.');
    const nextPlateau = holds.slice(holds.indexOf(firstSlow) + 1).find(item => item.metrics.p95 < firstSlow.metrics.p95);
    if (!nextPlateau) throw new Error('Stress comparison requires a later measured plateau with lower p95.');
    const others = holds.filter(item => item !== firstSlow);
    return [
      q(1, 'theory', 'Stress test là gì?', [
        'Kiểm thử ngắn với tải rất nhỏ để xác nhận luồng API cơ bản.',
        'Kiểm thử chỉ duy trì đúng tải bình thường để tạo số liệu nền.',
        'Kiểm thử chỉ thay đổi giao diện mà không tạo tải lên API.',
        'Kiểm thử tăng tải vượt mức bình thường để quan sát sự suy giảm, giới hạn và khả năng phục hồi.'
      ], 'D', 'Stress test khảo sát hệ thống khi tải vượt điều kiện sử dụng bình thường. Bài này tăng qua nhiều bậc tải, sau đó giảm tải để quan sát phục hồi.'),
      q(2, 'theory', 'Vì sao cần quan sát cả giai đoạn phục hồi sau khi tăng tải?', [
        'Để xóa các lỗi đã xuất hiện tại các bậc tải cao.',
        'Để kiểm tra hệ thống có trở lại đáp ứng yêu cầu sau khi tải giảm hay vẫn tiếp tục chậm hoặc lỗi.',
        'Để lấy p95 phục hồi thay cho p95 của mọi bậc tải trước đó.',
        'Để không cần thu số liệu tại các bậc tải cao.'
      ], 'B', 'Giảm tải không bảo đảm hệ thống lập tức trở lại bình thường. Cần quan sát độ trễ, lỗi và checks ở cửa sổ recovery; kết quả này không xóa các vi phạm trước đó.'),
      q(3, 'data', 'Quan sát các bậc tải theo thứ tự trong bài. Bậc nào đầu tiên có p95 vượt 500 ms?', [
        `${others[0].vus} VUs.`, `${others[1].vus} VUs.`, `${firstSlow.vus} VUs.`, `${others.at(-1).vus} VUs.`
      ], 'C', `Bậc ${firstSlow.vus} VUs là bậc đầu tiên có p95 vượt 500 ms, với p95 khoảng ${number(firstSlow.metrics.p95)} ms. Đây là kết quả của các bậc đã đo, chưa xác định giới hạn chính xác nằm giữa các bậc.`),
      q(4, 'data', `Ở ${firstSlow.vus} VUs, p95 khoảng ${number(firstSlow.metrics.p95)} ms; ở ${nextPlateau.vus} VUs, p95 khoảng ${number(nextPlateau.metrics.p95)} ms. Vì sao chưa thể kết luận ${firstSlow.vus} VUs là giới hạn chịu tải chính xác của hệ thống?`, [
        'Vì p95 chỉ có ý nghĩa trong Smoke test.',
        'Vì phải chọn bậc tải lớn nhất làm giới hạn, bất kể kết quả.',
        'Vì độ trễ có thể dao động giữa các cửa sổ đo; một bậc vi phạm chưa đủ xác định giới hạn chính xác.',
        `Vì kết quả ở ${nextPlateau.vus} VUs chứng minh mọi mức tải cao hơn đều đạt.`
      ], 'C', 'p95 không tăng đều theo số VUs trong lần chạy này. Cần đối chiếu thêm lỗi, checks, tài nguyên và các lần chạy lặp lại trước khi kết luận về giới hạn chịu tải.')
    ];
  }
  if (lesson.id === 'spike') return [
    q(1, 'theory', 'Spike test là gì?', [
      'Kiểm thử duy trì tải đều trong nhiều giờ để tìm sự suy giảm dài hạn.',
      'Kiểm thử ngắn với tải rất nhỏ để xác nhận script chạy được.',
      'Kiểm thử phản ứng của hệ thống khi tải tăng đột ngột và khả năng phục hồi sau khi tải giảm.',
      'Kiểm thử chỉ đo hệ thống khi không có người dùng nào hoạt động.'
    ], 'C', 'Spike test tập trung vào sự biến đổi tải đột ngột. Cần quan sát cả đỉnh tải và giai đoạn trở lại tải nền.'),
    q(2, 'theory', 'Hình dạng tăng tải của Spike test khác Stress test trong bài học này như thế nào?', [
      'Spike giữ tải không đổi; Stress không tạo tải.',
      'Spike tăng chậm hơn Stress ở mọi giai đoạn.',
      'Hai bài luôn có hình dạng tải giống nhau, chỉ khác tên.',
      'Spike tăng tải đột ngột lên đỉnh, còn Stress tăng qua nhiều bậc tải để quan sát sự suy giảm.'
    ], 'D', `Ở bài Spike, tải nhảy từ ${lesson.stages[0].to} lên ${lesson.peakVus} VUs rồi trở về ${lesson.stages.at(-1).to} VUs. Ở bài Stress, tải tăng qua nhiều bậc để quan sát sự suy giảm.`),
    q(3, 'data', `Ở giai đoạn ${phase.vus} VUs, p95 khoảng ${number(phase.metrics.p95)} ms, tỷ lệ HTTP lỗi ${number(phase.metrics.errorRate * 100)}%. Yêu cầu là p95 < 500 ms và lỗi < 1%. Kết luận nào phù hợp nhất?`, [
      'Không đạt vì chỉ cần có một request lỗi HTTP là vi phạm ngưỡng lỗi < 1%.',
      'Đạt cả hai điều kiện tại đỉnh tải này, dù vẫn có một tỷ lệ nhỏ request lỗi HTTP.',
      'Không đạt vì p95 phải nhỏ hơn 1 ms.',
      `Đạt nên chắc chắn mọi mức tải lớn hơn ${phase.vus} VUs cũng đều đạt.`
    ], 'B', `Tại ${phase.vus} VUs, p95 khoảng ${number(phase.metrics.p95)} ms dưới 500 ms và HTTP lỗi khoảng ${number(phase.metrics.errorRate * 100)}% dưới 1%. Hai điều kiện đều đạt; tỷ lệ lỗi không cần bằng 0 khi ngưỡng cho phép nhỏ hơn 1%.`),
    q(4, 'data', `Tại ${phase.vus} VUs, p50 ≈ ${number(phase.metrics.p50)} ms, p95 ≈ ${number(phase.metrics.p95)} ms và p99 ≈ ${number(phase.metrics.p99)} ms. Nếu chỉ báo cáo p50, thông tin nào có thể bị bỏ sót?`, [
      'Một nhóm request phản hồi chậm hơn nhiều so với mức trung vị; p50 không thể hiện đầy đủ phần đuôi độ trễ.',
      'Chính xác 95% request bị lỗi.',
      'Tất cả request đều mất hơn 500 ms.',
      `Hệ thống chỉ xử lý được ${number(phase.metrics.p50)} request mỗi giây.`
    ], 'A', 'p50 cho thấy mức trung vị, còn p95 và p99 thể hiện các phân vị cao của độ trễ. Nhóm request ở phần đuôi chậm hơn đáng kể so với trung vị, dù p95 vẫn đạt ngưỡng 500 ms. Không thể dùng p50 thay cho toàn bộ phân bố độ trễ.')
  ];
  throw new Error(`Unknown lesson: ${lesson.id}`);
}
