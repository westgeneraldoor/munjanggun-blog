const fs = require('fs');
const path = require('path');
const { ROOT_DIR } = require('./paths');

/**
 * 프로젝트 루트의 .env 파일을 찾아 process.env에 주입하는 함수
 */
function loadEnv() {
  // 스크립트 파일 기준으로 프로젝트 루트의 .env 경로 계산
  const envPath = path.join(ROOT_DIR, '.env');

  if (fs.existsSync(envPath)) {
    try {
      const envContent = fs.readFileSync(envPath, 'utf-8');
      const lines = envContent.split(/\r?\n/);

      lines.forEach((line) => {
        const trimmed = line.trim();
        // 빈 줄 및 주석 제외
        if (trimmed && !trimmed.startsWith('#')) {
          const index = trimmed.indexOf('=');
          if (index !== -1) {
            const key = trimmed.substring(0, index).trim();
            const val = trimmed.substring(index + 1).trim();
            
            // 이미 정의된 환경변수가 아닐 때만 덮어씀 (외부 환경변수 우선)
            if (key && !process.env[key]) {
              process.env[key] = val;
            }
          }
        }
      });
    } catch (err) {
      console.warn(`⚠️ .env 로딩 실패: ${err.message}`);
    }
  }
}

// 모듈 로드 시 자동으로 환경변수 바인딩 실행
loadEnv();

module.exports = {
  loadEnv
};
