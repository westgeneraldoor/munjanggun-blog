const fs = require('fs');
const path = require('path');

const REAL_HISTORY = path.join(__dirname, '../tracking_history.json');
const MOCK_HISTORY = path.join(__dirname, '../tracking_history_mock.json');

function generateMock() {
  const data = JSON.parse(fs.readFileSync(REAL_HISTORY, 'utf8'));
  const latestRecord = data.records[data.records.length - 1]; // 50개 꽉 찬 최신 데이터
  
  const mockRecords = [];
  
  // 오늘 기준 과거 7일 치 데이터를 가상으로 생성 (역순으로 시간 되감기)
  for (let i = 7; i >= 0; i--) {
    const mockDate = new Date(latestRecord.timestamp);
    mockDate.setDate(mockDate.getDate() - i);
    
    // 순위를 살짝씩 흔들어줌 (과거일수록 변동이 있게)
    const mockRankings = latestRecord.rankings.map(r => {
      let newRank = r.rank;
      if (r.rank > 0 && r.rank <= 30) {
        // -3 ~ +3 정도 랜덤 변동
        const randomChange = Math.floor(Math.random() * 7) - 3;
        newRank = Math.max(1, Math.min(30, r.rank + randomChange));
      } else if (r.rank === 0) {
        // 순위 밖인 애들도 예전엔 20위권이었을 수도 있음 (10% 확률)
        if (Math.random() < 0.1) newRank = 25 + Math.floor(Math.random() * 5);
      }
      
      // 최신(오늘) 데이터는 원본 그대로 유지
      if (i === 0) newRank = r.rank;

      return {
        ...r,
        rank: newRank
      };
    });

    mockRecords.push({
      date: mockDate.toISOString().split('T')[0],
      timestamp: mockDate.toISOString(),
      rankings: mockRankings
    });
  }

  const mockData = { version: 3, records: mockRecords };
  fs.writeFileSync(MOCK_HISTORY, JSON.stringify(mockData, null, 2), 'utf8');
  console.log('✅ 가상 데이터(7일치) 생성 완료: ' + MOCK_HISTORY);
}

generateMock();
