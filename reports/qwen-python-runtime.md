# Qwen Python 런처와 공통 실행 설정

여러 배치 분기와 Python 진입점에서 서로 다른 설정을 읽던 실행 환경을 단일 런처와 공통 JSON 설정으로 정리한 구성 기록이다. 잔존 환경변수와 외부 체크아웃 경로가 실행 동작을 의도치 않게 바꾸는 문제에 초점을 맞췄다.

## 1. 다룬 문제

- 배치 파일의 goto·shift·인자 분기가 길어 실행 경로를 확인하기 어려웠다.
- CLI·TUI·Web UI에서 설정값을 각각 관리하면 모델·서버 주소가 달라질 수 있었다.
- 남아 있는 환경변수가 공통 설정을 덮어쓰는지 분명하지 않았다.
- 외부 체크아웃이 존재한다는 이유로 다른 프로젝트의 agent가 우선 실행될 수 있었다.

## 2. 단일 실행 진입점

```text
ollama_qwen.cmd
  └─ scripts/qwen_launcher.py
       ├─ chat → CLI
       ├─ agent → 로컬 agent 라우팅
       ├─ tui → TUI
       ├─ web → Web UI
       └─ doctor → 적용 설정 확인
```

배치 파일은 호환 래퍼로 두고, 인자와 실행 모드의 처리는 Python 런처에 모으는 구조다. 공통 설정은 runtime_config.py가 읽어 각 진입점에 전달한다.

## 3. 설정 우선순위와 경로 정책

| 항목 | 정리한 기준 |
| --- | --- |
| 기본 설정 | config/runtime.json |
| 설정 로더 | runtime_config.py |
| 환경변수 | 명시적인 허용 옵션이 있을 때 임시 덮어쓰기 |
| agent 기본값 | 현재 프로젝트의 로컬 Python 런타임 |
| 외부 명령 | 별도 설정으로 명시한 경우에만 선택 |

```json
{
  "ollama_host": "http://127.0.0.1:11435",
  "model": "<configured-model>",
  "agent": {"command": "<explicit-command-if-needed>"}
}
```

위 JSON은 설정 항목을 설명하는 축약 예시이며 원본 파일 전체를 대신하지 않는다. 실제 모델과 명령은 적용 설정 출력으로 확인한다.

## 4. 진단 기록

```text
ollama_qwen.cmd doctor
python -B scripts/qwen_launcher.py doctor
```

구성 문서에는 두 doctor 진입점과 관련 Python 파일의 py_compile 성공이 기록돼 있다. doctor는 프로젝트 루트, 설정 파일, 서버·모델과 agent 명령을 보여준다. 이 포트폴리오를 작성하면서 해당 소스와 실행을 새로 재검증한 것은 아니다.

## 5. 경험의 의미

실행 모드가 늘어날수록 설정값보다 적용 경로를 설명할 수 있어야 한다. 단일 런처, 공통 설정, 명시적인 환경변수 덮어쓰기와 경로 정책을 연결해 실행 환경의 재현성을 문서화했다. 직접 수정한 코드·커밋과 인자 전달 테스트를 붙이면 개발 기여를 더 구체적으로 제시할 수 있다.

- [Multi LLM MCP 워크벤치](multi-llm-mcp-workbench.md)
- [AI 실행 결과와 증거](ai-execution-evidence.md)
