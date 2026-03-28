# AI Agent Systems — Complete Research Documentation
> Full comparison: CrewAI, AutoGPT, LangGraph, AgentOps, Langfuse, SuperAGI, OpenAgents, AgentBench, Agent Patterns, Mac Mini Fleets, Infrastructure Platforms, Cost Analysis
> Knowledge cutoff: early 2025.

---

# AI Agent Platforms: CrewAI & AutoGPT — Detailed Technical Documentation

---

## Table of Contents

1. [CrewAI](#crewai)
   - [Core Architecture](#crewai-core-architecture)
   - [Agent Structure](#crewai-agent-structure)
   - [Tasks and Projects](#crewai-tasks-and-projects)
   - [Agent Communication and Coordination](#crewai-agent-communication)
   - [Agent Types and Roles](#crewai-agent-types)
   - [Task Execution and Tracking](#crewai-task-execution)
   - [Database and Storage](#crewai-database-storage)
   - [Deployment Model](#crewai-deployment)
   - [Unique Features](#crewai-unique-features)
   - [Limitations](#crewai-limitations)
   - [Code Examples](#crewai-code-examples)

2. [AutoGPT](#autogpt)
   - [Core Architecture](#autogpt-core-architecture)
   - [Agent Structure](#autogpt-agent-structure)
   - [Tasks and Projects](#autogpt-tasks-and-projects)
   - [Agent Communication and Coordination](#autogpt-agent-communication)
   - [Agent Types and Roles](#autogpt-agent-types)
   - [Task Execution and Tracking](#autogpt-task-execution)
   - [Database and Storage](#autogpt-database-storage)
   - [Deployment Model](#autogpt-deployment)
   - [Unique Features](#autogpt-unique-features)
   - [Limitations](#autogpt-limitations)
   - [Code Examples](#autogpt-code-examples)

3. [Comparison Summary](#comparison-summary)

---

# CrewAI

CrewAI is a Python framework for orchestrating role-playing, autonomous AI agents. It focuses on enabling agents to work together as a **crew** — each agent has a defined role, goal, and backstory, and they collaborate to complete complex, multi-step tasks. CrewAI sits on top of LangChain tooling but introduced its own agent loop and process management system.

---

## CrewAI Core Architecture

CrewAI's architecture centers on four primary abstractions:

```
Crew
 ├── Agents[]         — individual LLM-backed workers
 ├── Tasks[]          — units of work assigned to agents
 ├── Process          — orchestration strategy (sequential | hierarchical)
 └── Tools[]          — capabilities agents can invoke
```

### Key Components

**Crew**
The top-level container. A `Crew` holds a list of agents and tasks and executes them via a chosen `Process`. It is the entry point for running the entire workflow.

**Agent**
Each agent wraps an LLM and is given:
- A `role` (e.g., "Senior Data Analyst")
- A `goal` (specific objective)
- A `backstory` (persona context that shapes behavior)
- A set of `tools`
- Configuration for verbosity, memory, delegation, max iterations, etc.

**Task**
A discrete unit of work with:
- A natural language `description`
- An `expected_output` specification
- An assigned `agent`
- Optional `context` (results from prior tasks fed as input)
- Optional `output_file` for persisting results

**Process**
The orchestration strategy. Currently two main modes:
- `Process.sequential` — tasks run one after another in defined order
- `Process.hierarchical` — a manager agent (auto-created or designated) assigns and reviews tasks from worker agents

**Tools**
Python callables (or LangChain tools) that agents can use: web search, file read/write, code execution, API calls, custom functions. Tools are assigned per-agent.

---

## CrewAI Agent Structure

Each `Agent` object in CrewAI is defined with explicit persona metadata. Under the hood each agent runs its own **ReAct-style** reasoning loop (Thought → Action → Observation → repeat) until it produces a final answer.

```python
from crewai import Agent

researcher = Agent(
    role="Senior Research Analyst",
    goal="Uncover cutting-edge developments in AI and data science",
    backstory="""You work at a leading tech think tank. Your expertise lies
    in identifying emerging trends. You have a knack for dissecting complex
    data and presenting actionable insights.""",
    verbose=True,
    allow_delegation=False,
    tools=[search_tool, scrape_tool],
    llm=my_llm,                 # optional: override default LLM
    max_iter=15,                # max reasoning iterations
    memory=True,                # enable short-term memory
)
```

### Agent Internal Loop

When an agent receives a task:
1. It reads the task description and its own role/goal/backstory as system prompt context.
2. It enters a ReAct loop, optionally calling tools.
3. It produces a `Final Answer:` when done.
4. CrewAI captures this output and either passes it to the next task or returns it to the manager.

### Agent Memory

CrewAI supports multiple memory scopes:

| Memory Type | Scope | Backend |
|---|---|---|
| Short-term | Within a single crew run | In-process (RAG via embeddings) |
| Long-term | Across crew runs | SQLite (via CrewAI's built-in store) |
| Entity memory | Named entities extracted from conversations | In-process vector store |
| Contextual | Task outputs passed explicitly as context | Passed as string in task prompt |

---

## CrewAI Tasks and Projects

### Task Definition

Tasks are the atomic work units. Each task has a clear contract:

```python
from crewai import Task

research_task = Task(
    description="""Analyze the current state of the AI agent landscape.
    Focus on frameworks released in 2024-2025. Identify top 5 trends.""",
    expected_output="A structured report with 5 trend summaries, each with evidence.",
    agent=researcher,
    context=[],           # list of prior Task objects whose output feeds this task
    output_file="report.md",  # optional: write output to file
    async_execution=False,    # whether to run asynchronously (parallel crews)
    human_input=False,        # pause and request human feedback before finalizing
)
```

### Task Context Chaining

The `context` parameter is central to multi-step workflows. When a task lists other tasks in its `context`, CrewAI automatically injects the outputs of those tasks into the current task's prompt. This creates a data pipeline:

```
Task A (research) → output → Task B context
Task B (analysis) → output → Task C context
Task C (writing)  → final report
```

### Crews as Projects

A `Crew` groups agents and tasks into a runnable project:

```python
from crewai import Crew, Process

crew = Crew(
    agents=[researcher, writer],
    tasks=[research_task, write_task],
    process=Process.sequential,
    verbose=True,
    memory=True,
    cache=True,             # cache tool call results
    max_rpm=10,             # rate limit LLM calls
    manager_llm=gpt4,       # used only in hierarchical mode
)

result = crew.kickoff()
# or with inputs:
result = crew.kickoff(inputs={"topic": "quantum computing"})
```

### Templated Inputs

Tasks and agents support `{variable}` placeholders in their descriptions. When calling `crew.kickoff(inputs={"variable": "value"})`, CrewAI interpolates these at runtime. This enables reusable crew templates.

---

## CrewAI Agent Communication

CrewAI agents do **not** communicate peer-to-peer in real time. Communication follows a structured pattern based on the chosen Process.

### Sequential Process Communication

```
[Task 1 Agent] → produces output string
                      ↓ (injected as context)
[Task 2 Agent] → reads prior output, produces output
                      ↓
[Task 3 Agent] → ...
```

The "communication" is mediated by the Crew orchestrator, which routes task outputs as inputs to subsequent tasks. Agents are unaware of each other unless explicitly sharing context.

### Hierarchical Process Communication

In hierarchical mode, CrewAI creates (or uses a designated) **manager agent**:

```
[Manager Agent]
     ├── delegates Task A → [Worker Agent 1]
     ├── reviews output, delegates Task B → [Worker Agent 2]
     └── synthesizes final result
```

The manager agent uses an internal `Delegation` tool to assign subtasks to worker agents by name/role. Workers can also ask the manager questions via a `Question` mechanism. This is closer to true multi-agent communication but still mediated through structured tool calls, not direct agent-to-agent messaging.

### Human-in-the-Loop

Tasks with `human_input=True` pause execution before finalizing the agent's answer and prompt the user via stdin for feedback. The agent incorporates the feedback and re-evaluates.

---

## CrewAI Agent Types

CrewAI does not enforce rigid agent type categories — agents are defined by their role string and configuration. In practice, common patterns are:

| Conceptual Role | Typical Configuration |
|---|---|
| Researcher | Web search tools, high `max_iter`, allow_delegation=False |
| Analyst | Code interpreter tools, memory enabled |
| Writer/Editor | No tools or only file tools, focus on synthesis |
| Manager | No direct task assignment; used in hierarchical mode |
| QA/Reviewer | Receives prior task context, evaluates quality |
| Planner | Breaks down goals into sub-tasks for other agents |
| Executor | Runs code, interacts with APIs, file system |

### Built-in Agent Configurations (CrewAI Enterprise / Flows)

CrewAI introduced **Flows** for event-driven pipelines and **CrewAI Enterprise** for pre-built agent templates. In Flows:
- `@start()` decorated methods trigger a flow
- `@listen()` methods react to events from other steps
- Multiple crews can be chained within a single Flow

---

## CrewAI Task Execution and Tracking

### Execution Lifecycle

```
crew.kickoff()
  └── _run_sequential() or _run_hierarchical()
        ├── for each task:
        │     ├── build prompt (role + goal + backstory + task desc + context outputs)
        │     ├── agent._execute_task(task)
        │     │     └── ReAct loop (Thought/Action/Observation cycles)
        │     │           ├── tool_call() if action needed
        │     │           └── return Final Answer
        │     ├── capture output string
        │     ├── write to output_file if configured
        │     └── pass to next task's context
        └── return CrewOutput object
```

### CrewOutput Object

The return value of `crew.kickoff()` is a `CrewOutput` with:
- `raw` — raw string of the final task output
- `pydantic` — if output schema defined, parsed Pydantic model
- `json_dict` — if JSON output configured
- `tasks_output` — list of `TaskOutput` per task
- `token_usage` — total token counts

### Task Output Schema

Tasks can enforce structured output using Pydantic models:

```python
from pydantic import BaseModel
from crewai import Task

class ResearchReport(BaseModel):
    title: str
    summary: str
    key_findings: list[str]
    sources: list[str]

task = Task(
    description="Research AI agent frameworks",
    expected_output="A structured research report",
    agent=researcher,
    output_pydantic=ResearchReport,
)
```

### Callbacks

CrewAI supports callbacks for monitoring:

```python
def step_callback(agent_output):
    print(f"Agent step: {agent_output}")

def task_callback(task_output):
    print(f"Task complete: {task_output.description}")

crew = Crew(
    agents=[...],
    tasks=[...],
    step_callback=step_callback,
    task_callback=task_callback,
)
```

### Caching

Tool results can be cached to avoid redundant API calls. Cache is in-memory per crew run by default. Custom cache handlers can be injected.

---

## CrewAI Database and Storage

### Long-Term Memory Storage

CrewAI uses **SQLite** for long-term memory persistence (stored in `~/.crewai/` by default). The schema stores:
- Agent memory entries (key/value with embeddings)
- Entity extractions
- Run history metadata

### Knowledge Sources (CrewAI 0.80+)

CrewAI introduced a `knowledge` layer allowing agents to query static document corpora:

```python
from crewai.knowledge.source.pdf_knowledge_source import PDFKnowledgeSource

pdf_source = PDFKnowledgeSource(file_paths=["handbook.pdf"])

crew = Crew(
    agents=[agent],
    tasks=[task],
    knowledge_sources=[pdf_source],
)
```

Knowledge sources are embedded into a vector store (using `chroma` or `qdrant` backends). Agents retrieve relevant chunks automatically when formulating responses.

### Tool Result Caching

Stored in-memory during a run. Keyed by (tool_name, input_hash). Configurable per tool with `cache_function`.

### No Built-in Project/State DB

CrewAI does not maintain a persistent project or run state database beyond memory and knowledge. Each `crew.kickoff()` is largely stateless unless long-term memory is enabled.

---

## CrewAI Deployment Model

### Local / Script-based (Primary Mode)

CrewAI is primarily a Python library. Deployment is as simple as running a Python script:

```bash
pip install crewai crewai-tools
python my_crew.py
```

### CrewAI CLI

The `crewai` CLI scaffolds and runs crews:

```bash
crewai create crew my_project    # scaffold a new crew project
crewai run                        # run the crew defined in the project
crewai train -n 5                 # train agents with n feedback iterations
crewai test -n 3                  # evaluate with n test runs
crewai replay -t <task_id>        # replay a specific task from prior run
```

### CrewAI Enterprise (Cloud Platform)

CrewAI offers a hosted platform with:
- Visual crew builder UI
- Deployment as REST API endpoints
- Execution monitoring and logs dashboard
- Pre-built agent templates and tool integrations
- Team collaboration features

### Integration Patterns

- **FastAPI wrapper** — expose crew.kickoff() as an HTTP endpoint
- **Celery/background tasks** — run crews as async jobs
- **LangServe** — serve via LangChain's serving layer
- **Docker** — containerize the crew script with dependencies

### LLM Provider Support

CrewAI delegates LLM calls through LiteLLM, supporting:
- OpenAI (GPT-4, GPT-4o, o1)
- Anthropic (Claude 3.x, Claude Sonnet 4)
- Google (Gemini)
- Ollama (local models)
- Azure OpenAI
- Any OpenAI-compatible endpoint

---

## CrewAI Unique Features

### Role-Based Persona System
The role/goal/backstory triad is central to CrewAI's differentiation. Unlike frameworks that treat agents as generic function-callers, CrewAI encodes expertise and personality into each agent, which meaningfully shapes LLM output quality for specialized tasks.

### Hierarchical Process with Manager Agent
Auto-creation of a manager agent that can dynamically delegate and review work without the user manually wiring task dependencies. This mirrors real organizational structures.

### Human-in-the-Loop at Task Level
Granular control: specific tasks can pause for human review without blocking others. This is more surgical than frameworks that apply HITL at the entire flow level.

### Task Output Schemas with Pydantic
Structured output enforcement at the task level with automatic retry if the LLM produces invalid output. This makes CrewAI outputs reliable for downstream programmatic use.

### Flows (Event-Driven Orchestration)
CrewAI Flows allow conditional branching and event-driven execution across multiple crews, enabling complex enterprise workflows beyond simple sequential pipelines.

### Training Mode
`crewai train` runs the crew multiple times, collecting human feedback, and fine-tunes agent behavior through few-shot examples stored in a training dataset.

### Built-in Rate Limiting and Retry Logic
`max_rpm` on the Crew controls LLM call rate. Built-in exponential backoff for API errors reduces failure in production scenarios.

---

## CrewAI Limitations

- **No real-time agent messaging** — agents cannot send messages to each other directly; all coordination flows through task context strings or the manager agent's delegation tool.
- **LLM-dependent quality** — the quality of the entire system is bounded by the LLM used. Weaker models produce poor ReAct loops and often fail to use tools correctly.
- **Sequential bottleneck** — in sequential mode, one slow or failing task blocks the entire pipeline.
- **Limited async support** — while `async_execution=True` exists per task, full async parallelism across tasks within a single crew is limited.
- **Memory scalability** — long-term SQLite memory is not designed for high-concurrency production workloads.
- **No native streaming** — outputs are returned after full completion, not streamed token-by-token.
- **Context window management** — passing long task outputs as context can exhaust LLM context windows on complex multi-step pipelines.
- **Debugging difficulty** — when a crew fails mid-run, pinpointing whether the issue is the LLM, tool, or orchestration logic requires verbose logging.
- **Enterprise platform cost** — the hosted platform is not open source.

---

## CrewAI Code Examples

### Complete Example: Research and Writing Crew

```python
from crewai import Agent, Task, Crew, Process
from crewai_tools import SerperDevTool, WebsiteSearchTool
from langchain_openai import ChatOpenAI

# Initialize LLM
llm = ChatOpenAI(model="gpt-4o", temperature=0.7)

# Initialize tools
search_tool = SerperDevTool()
web_tool = WebsiteSearchTool()

# Define agents
researcher = Agent(
    role="Senior Research Analyst",
    goal="Uncover comprehensive information about {topic}",
    backstory="""You are an expert researcher with 10 years of experience in
    technology analysis. You excel at finding accurate, current information
    and synthesizing it into clear insights.""",
    verbose=True,
    allow_delegation=False,
    tools=[search_tool, web_tool],
    llm=llm,
    max_iter=10,
    memory=True,
)

writer = Agent(
    role="Technical Content Writer",
    goal="Write compelling and accurate technical content about {topic}",
    backstory="""You are a skilled technical writer who transforms complex
    research into clear, engaging content for a professional audience.
    You always cite sources and maintain factual accuracy.""",
    verbose=True,
    allow_delegation=False,
    llm=llm,
)

# Define tasks
research_task = Task(
    description="""Research {topic} thoroughly. Find:
    1. Current state of the technology
    2. Key players and innovations
    3. Recent developments (last 12 months)
    4. Future outlook
    Gather at least 5 authoritative sources.""",
    expected_output="""A comprehensive research brief with:
    - Executive summary (200 words)
    - Key findings organized by category
    - Source list with URLs""",
    agent=researcher,
    output_file="research_brief.md",
)

writing_task = Task(
    description="""Using the research brief provided, write a professional
    article about {topic}. Include:
    - Engaging introduction
    - 4-5 main sections with headers
    - Concrete examples and data points
    - Conclusion with future implications
    Target audience: technical professionals""",
    expected_output="A 1500-word professional article in markdown format",
    agent=writer,
    context=[research_task],  # writer gets researcher's output
    output_file="article.md",
)

# Create and run crew
crew = Crew(
    agents=[researcher, writer],
    tasks=[research_task, writing_task],
    process=Process.sequential,
    verbose=True,
    memory=True,
    cache=True,
    max_rpm=10,
)

result = crew.kickoff(inputs={"topic": "AI agent frameworks in 2025"})
print(result.raw)
```

### Hierarchical Process Example

```python
from crewai import Agent, Task, Crew, Process
from langchain_openai import ChatOpenAI

gpt4 = ChatOpenAI(model="gpt-4o")
gpt35 = ChatOpenAI(model="gpt-3.5-turbo")

# Worker agents
analyst = Agent(
    role="Data Analyst",
    goal="Analyze data and extract insights",
    backstory="Expert data analyst with statistical background",
    llm=gpt35,
)

designer = Agent(
    role="Report Designer",
    goal="Create well-structured reports",
    backstory="Expert at organizing and presenting information clearly",
    llm=gpt35,
)

# Tasks
analyze_task = Task(
    description="Analyze the provided sales data and identify top trends",
    expected_output="Bullet-point list of 5 key trends with supporting data",
    agent=analyst,
)

design_task = Task(
    description="Design a professional report summarizing the analysis",
    expected_output="A formatted report with sections and visualizations described",
    agent=designer,
)

# Hierarchical crew — manager_llm orchestrates automatically
crew = Crew(
    agents=[analyst, designer],
    tasks=[analyze_task, design_task],
    process=Process.hierarchical,
    manager_llm=gpt4,   # manager uses stronger model
    verbose=True,
)

result = crew.kickoff()
```

### Structured Output Example

```python
from pydantic import BaseModel, Field
from crewai import Agent, Task, Crew
from typing import List

class CompetitorAnalysis(BaseModel):
    company_name: str
    strengths: List[str] = Field(description="List of key strengths")
    weaknesses: List[str] = Field(description="List of key weaknesses")
    market_position: str
    threat_level: str = Field(description="low, medium, or high")

class MarketReport(BaseModel):
    title: str
    competitors: List[CompetitorAnalysis]
    overall_recommendation: str

analyst = Agent(
    role="Market Intelligence Analyst",
    goal="Produce structured competitive analysis",
    backstory="Expert in competitive intelligence and market research",
)

task = Task(
    description="Analyze the top 3 competitors in the cloud storage market",
    expected_output="Structured competitive analysis with scoring",
    agent=analyst,
    output_pydantic=MarketReport,  # enforce structured output
)

crew = Crew(agents=[analyst], tasks=[task])
result = crew.kickoff()

# Access structured data
report: MarketReport = result.pydantic
for competitor in report.competitors:
    print(f"{competitor.company_name}: threat={competitor.threat_level}")
```

### CrewAI Flow Example

```python
from crewai.flow.flow import Flow, listen, start
from crewai import Crew, Task, Agent

class ContentPipeline(Flow):
    @start()
    def generate_topic(self):
        # Initial step: generate or receive a topic
        return "The future of quantum computing"

    @listen(generate_topic)
    def research_topic(self, topic):
        # Spin up a research crew
        researcher = Agent(role="Researcher", goal="Research {topic}", backstory="...")
        task = Task(description="Research {topic}", expected_output="...", agent=researcher)
        crew = Crew(agents=[researcher], tasks=[task])
        return crew.kickoff(inputs={"topic": topic}).raw

    @listen(research_topic)
    def write_article(self, research):
        # Spin up a writing crew with research as context
        writer = Agent(role="Writer", goal="Write an article", backstory="...")
        task = Task(
            description=f"Write an article based on: {research}",
            expected_output="1000-word article",
            agent=writer,
        )
        crew = Crew(agents=[writer], tasks=[task])
        return crew.kickoff().raw

flow = ContentPipeline()
final_article = flow.kickoff()
```

---

# AutoGPT

AutoGPT is one of the earliest and most influential autonomous AI agent projects, originally created by Toran Bruce Richards and open-sourced in April 2023. It demonstrated that LLMs could operate in a self-directed loop — breaking down goals, taking actions, reflecting on results, and continuing autonomously without per-step human prompting. It spawned an entire genre of "autonomous agent" projects.

The project has evolved significantly: the original Python script evolved into a full platform called **AutoGPT Platform** (formerly "AutoGPT Forge" and "AutoGPT Server") with a visual builder, a backend API, and a marketplace of pre-built agent behaviors called **Blocks**.

---

## AutoGPT Core Architecture

AutoGPT's architecture has two distinct eras:

### Era 1: Classic AutoGPT (2023)

```
User Goal (natural language)
      ↓
[AutoGPT Agent Loop]
  ├── THOUGHTS  — reasoning about current state
  ├── REASONING — justification for next action
  ├── PLAN      — short-term plan as bullet list
  ├── CRITICISM — self-critique of the plan
  └── ACTION    — tool call (command + args)
        ↓
  [Tool Execution] (browse web, run code, read/write files, search)
        ↓
  [Observation] — tool result injected back into context
        ↓
  [Back to top] — loop continues until task_complete command
```

The agent maintained a **rolling context window**: as conversation history grew, older messages were summarized and compressed using a separate LLM call to stay within token limits.

Memory was maintained via a **vector store** (Pinecone, Redis, Milvus, or local) for long-term recall, plus the in-context rolling window for short-term working memory.

### Era 2: AutoGPT Platform (2024-2025)

```
AutoGPT Platform
  ├── AutoGPT Server (backend API — FastAPI + Python)
  │     ├── Graph Execution Engine
  │     ├── Block Registry (100+ pre-built blocks)
  │     ├── Agent Runner (manages execution state)
  │     └── Scheduler (cron, webhook, event triggers)
  │
  ├── AutoGPT Frontend (Next.js UI)
  │     ├── Visual Flow Builder (drag-and-drop blocks)
  │     ├── Agent Monitor (execution logs, status)
  │     └── Marketplace (community blocks/agents)
  │
  └── AutoGPT Benchmark (evaluation framework)
```

The platform treats agents as **directed graphs** of connected **Blocks**. Each block is a discrete operation (LLM call, web search, data transform, API call, file operation, etc.). Agents are built by connecting blocks visually or via JSON graph definitions.

---

## AutoGPT Agent Structure

### Classic Agent Structure

A classic AutoGPT agent is defined by:

```python
# Core configuration (from classic AutoGPT)
ai_name = "ResearcherGPT"
ai_role = "An AI research assistant"
ai_goals = [
    "Research the top 5 AI agent frameworks",
    "Compare their features and write a report",
    "Save the report as research_report.md",
]
```

The agent maintains a structured prompt with:
- **System prompt** — defines the agent's name, role, and available commands
- **Memory** — vector-searched relevant memories prepended to context
- **Message history** — recent interactions (compressed when window fills)
- **Goals** — injected at every loop iteration as reminders

### Platform Agent Structure (Graph-based)

In the AutoGPT Platform, an agent is defined as a **graph**:

```json
{
  "id": "agent-uuid",
  "name": "Web Research Agent",
  "description": "Searches the web and summarizes results",
  "nodes": [
    {
      "id": "node-1",
      "block_id": "trigger-webhook",
      "input_default": {}
    },
    {
      "id": "node-2",
      "block_id": "web-search",
      "input_default": {"num_results": 5}
    },
    {
      "id": "node-3",
      "block_id": "llm-call",
      "input_default": {
        "model": "gpt-4o",
        "prompt": "Summarize these search results: {results}"
      }
    },
    {
      "id": "node-4",
      "block_id": "output-text"
    }
  ],
  "links": [
    {"from_node": "node-1", "to_node": "node-2", "from_output": "payload", "to_input": "query"},
    {"from_node": "node-2", "to_node": "node-3", "from_output": "results", "to_input": "results"},
    {"from_node": "node-3", "to_node": "node-4", "from_output": "response", "to_input": "value"}
  ]
}
```

---

## AutoGPT Tasks and Projects

### Classic AutoGPT Tasks

In classic AutoGPT, "tasks" are not formally structured. The agent receives goals and autonomously decomposes them:
- Goals are provided at startup
- The agent self-generates a PLAN each iteration
- Actions are chosen based on the plan and current memory state
- The `task_complete` command terminates the loop

The agent tracks its own progress through internal reasoning — there is no formal task queue or state machine. This was both a strength (flexibility) and a weakness (unpredictability).

### Platform Tasks and Runs

The AutoGPT Platform has formal task/run management:

- **Agent Graph** — the template/definition (static)
- **Agent Run** — an execution instance of a graph with specific inputs
- **Run State** — `QUEUED`, `RUNNING`, `PAUSED`, `COMPLETED`, `FAILED`
- **Execution Log** — per-node execution records with inputs, outputs, timestamps, errors

Runs are created via:
- **API trigger** — POST to the server API with input payload
- **Webhook trigger** — external HTTP call triggers the graph
- **Schedule trigger** — cron-based periodic execution
- **Manual trigger** — started from the UI

### Projects (Platform)

The Platform UI organizes agents into projects/workspaces. Each project can contain multiple agent graphs. Teams can collaborate on a shared project with access controls in the hosted version.

---

## AutoGPT Agent Communication

### Classic AutoGPT: No Multi-Agent Communication

Classic AutoGPT was single-agent. It could spawn subprocesses or call tools, but there was no concept of multiple LLM agents communicating. Community forks like **BabyAGI** added a task queue concept, but the core AutoGPT remained single-agent.

### Platform: Block-Based Data Flow

In the Platform, "communication" between components is the **data flow** between blocks through defined links. This is dataflow-style programming, not agent-to-agent messaging.

```
[Block A: Web Search] --results--> [Block B: LLM Summarize] --summary--> [Block C: Email Send]
```

### Platform: Sub-Agent Blocks

AutoGPT Platform has **Agent blocks** — blocks that spin up a nested AutoGPT classic-style agent loop to handle a subtask. This enables pseudo-hierarchical multi-agent behavior:

```
[Outer Graph]
  [Task Dispatcher Block]
       ├── spawns Agent A (research subtask)
       ├── spawns Agent B (writing subtask)
       └── [Aggregator Block] collects results
```

Agent blocks expose a `task` input and `result` output, making them composable within graphs.

### AutoGPT Forge: Agent Protocol

AutoGPT introduced the **Agent Protocol** — a standardized REST API specification for AI agents:

```
POST /ap/v1/agent/tasks          — create a new task
POST /ap/v1/agent/tasks/{id}/steps — execute next step
GET  /ap/v1/agent/tasks/{id}/steps — list steps taken
GET  /ap/v1/agent/tasks/{id}/artifacts — list produced files
```

This protocol allows different agent implementations to be interoperable and benchmarked uniformly. It enables an orchestrator to control multiple heterogeneous agents through a common interface.

---

## AutoGPT Agent Types

### Classic AutoGPT Agent Types (by configuration)

Classic AutoGPT doesn't have formal agent types — there is one architecture instantiated with different goals/personas. Community-defined patterns include:

| Pattern | Description |
|---|---|
| Research Agent | Goals focused on information gathering, web browsing, note-taking |
| Code Agent | Goals focused on writing, testing, debugging code |
| Business Analyst | Goals focused on market research, report generation |
| Personal Assistant | Goals for task management, email drafting, scheduling |
| Data Agent | Goals for data collection, transformation, analysis |

### Platform Block Types

The Platform defines agents by the blocks they use. Block categories:

| Category | Examples |
|---|---|
| AI/LLM | LLM Text Generator, AI Conversation, Image Generation |
| Web | Web Search (Serper/SERPAPI), Web Scraper, HTTP Request |
| Data | Text Parser, JSON Transformer, List Operations |
| Integration | GitHub, Slack, Discord, Notion, Airtable, Email |
| Logic | Condition (if/else), Loop, Merge Branches |
| Storage | File Read/Write, Database Query |
| Agent | AI Agent (sub-agent loop), Agent Input/Output |
| Triggers | Webhook, Schedule, Manual |

---

## AutoGPT Task Execution and Tracking

### Classic Execution Loop (detailed)

```
initialize_agent(goals, memory, tools)
  ↓
while True:
  1. retrieve_relevant_memories(context) → vector search
  2. construct_prompt(system + memories + history + goals + last_result)
  3. llm_call(prompt) → response with THOUGHTS/PLAN/CRITICISM/ACTION
  4. parse_action(response) → command, args
  5. if command == "task_complete": break
  6. execute_command(command, args) → result string
  7. if result too long: summarize_result(result)
  8. save_to_memory(result)  ← vector store
  9. append_to_history(action, result)
  10. if history too long: compress_oldest_messages()
  11. goto 1
```

Each iteration was called a **"cycle"**. Users could set `--continuous` mode (run without pausing) or interactive mode (confirm each action).

### Platform Execution Tracking

The Platform backend tracks execution at the block level:

```
AgentGraphExecution
  ├── id: uuid
  ├── agent_graph_id
  ├── status: QUEUED | RUNNING | COMPLETED | FAILED
  ├── started_at, completed_at
  └── NodeExecutions[]
        ├── node_id
        ├── status
        ├── input_data (JSON)
        ├── output_data (JSON)
        ├── error (if failed)
        └── add_time, queue_time, start_time, end_time
```

The UI renders this as a live execution graph view — nodes light up as they execute, showing real-time data flow.

### Error Handling and Retry

- Blocks can be configured with retry count and backoff
- Failed node executions are logged with full error context
- The graph can be re-run from a failed node (partial re-execution)
- Individual nodes can be tested in isolation from the UI

---

## AutoGPT Database and Storage

### Classic AutoGPT Storage

| Storage Layer | Purpose | Backend Options |
|---|---|---|
| Vector Memory | Long-term semantic recall | Pinecone, Redis, Milvus, Weaviate, local ChromaDB |
| File System | Agent-created files, code, reports | Local disk (`auto_gpt_workspace/`) |
| In-context memory | Short-term working memory | LLM context window |
| Config | Agent settings, API keys | `.env` file, `ai_settings.yaml` |

### Platform Storage Architecture

The AutoGPT Platform uses a more structured database approach:

**PostgreSQL** (primary relational store):
- `AgentGraph` — agent definitions (nodes, links, metadata)
- `AgentGraphExecution` — run instances and status
- `AgentNodeExecution` — per-node execution records
- `User` — user accounts and API keys
- `Block` — registered block definitions

**Redis** (optional):
- Execution queue for distributed workers
- Pub/sub for real-time UI updates

**Supabase** (hosted platform):
- The cloud-hosted version of AutoGPT uses Supabase (PostgreSQL-as-a-service)
- Row-level security for multi-tenant isolation

**File Storage**:
- Agent-produced artifacts stored locally or in S3-compatible storage
- Referenced by artifact UUID in the database

### Workspace Isolation

Each agent run has an isolated workspace directory for file operations, preventing cross-run file conflicts.

---

## AutoGPT Deployment Model

### Classic AutoGPT Deployment

```bash
git clone https://github.com/Significant-Gravitas/AutoGPT
cd AutoGPT/classic/original_autogpt
pip install -r requirements.txt
cp .env.template .env  # add API keys
python -m autogpt --gpt4only  # run with GPT-4
```

Purely local, single-process. No server component. Suitable for personal use and experimentation.

### Platform Deployment (Self-Hosted)

The Platform uses Docker Compose for self-hosting:

```yaml
# docker-compose.yml (simplified)
services:
  autogpt-server:
    image: autogpt-server:latest
    environment:
      - DATABASE_URL=postgresql://...
      - OPENAI_API_KEY=${OPENAI_API_KEY}
    ports:
      - "8000:8000"

  autogpt-frontend:
    image: autogpt-frontend:latest
    ports:
      - "3000:3000"

  postgres:
    image: postgres:15
    volumes:
      - pgdata:/var/lib/postgresql/data

  redis:
    image: redis:7
```

```bash
docker compose up -d
# Access UI at http://localhost:3000
# API at http://localhost:8000
```

### Platform Deployment (Cloud / AutoGPT.com)

The official hosted SaaS at **autogpt.com** provides:
- Managed backend with autoscaling
- No infrastructure setup required
- Usage-based pricing
- Built-in LLM API key management
- Community marketplace for sharing agents

### Agent Protocol Server (Forge)

AutoGPT Forge provides a base class for building custom agents that comply with the Agent Protocol:

```python
from forge.sdk import Agent, AgentDB, Step, Task, TaskRequestBody, StepRequestBody

class MyAgent(Agent):
    async def create_task(self, task_request: TaskRequestBody) -> Task:
        # Initialize task
        task = await self.db.create_task(task_request)
        return task

    async def execute_step(self, task_id: str, step_request: StepRequestBody) -> Step:
        # Execute one step of reasoning
        task = await self.db.get_task(task_id)
        # ... agent logic ...
        step = await self.db.create_step(task_id, step_request, is_last=False)
        return step
```

This makes the agent deployable as a standardized REST API server.

---

## AutoGPT Unique Features

### Self-Directed Goal Decomposition
Classic AutoGPT's core innovation was demonstrating that a single LLM could maintain a goal, decompose it into steps, execute those steps using tools, reflect on results, and continue — all without per-step human instruction. This was groundbreaking in early 2023.

### Agent Protocol Standard
AutoGPT proposed and implemented the **Agent Protocol** — a vendor-neutral REST API standard for AI agents. This enables benchmarking, interoperability, and standardized integration of diverse agent implementations.

### AutoGPT Benchmark (AgBenchmark)
A comprehensive evaluation framework that tests agents against a suite of tasks across categories (coding, data analysis, web research, etc.) with automated scoring. This enables objective comparison of agent implementations.

### Visual Block-Based Builder
The Platform's drag-and-drop interface makes agent construction accessible to non-developers. Users can build sophisticated multi-step automation pipelines without writing code.

### Marketplace Ecosystem
Community-contributed blocks and complete agent graphs are shareable via the marketplace. This creates a library of reusable agent components.

### Dual Architecture Support
AutoGPT uniquely supports both:
1. **Classic ReAct agents** (flexible, autonomous, code-driven)
2. **Graph-based pipeline agents** (deterministic, visual, no-code)

This covers both the exploration/research use case and the production automation use case.

### Scheduled and Event-Driven Execution
Built-in scheduling and webhook triggers enable agents to run autonomously on schedules or in response to external events — without a human initiating each run.

---

## AutoGPT Limitations

### Classic AutoGPT Limitations

- **Context window exhaustion** — long-running tasks eventually fill the context window; compression causes memory loss and goal drift
- **Goal drift** — agents frequently deviate from original goals after many cycles, especially with GPT-3.5
- **Infinite loops** — without careful goal specification, agents can loop or pursue irrelevant subtasks indefinitely
- **Tool reliability** — web browsing and code execution are error-prone; agents often get stuck on tool failures
- **Expensive** — continuous mode makes many LLM calls, leading to high API costs
- **Non-deterministic** — the same goals can produce completely different execution paths across runs
- **No multi-agent coordination** — inherently single-agent in the classic form
- **Limited to text I/O** — multimodal capabilities were bolted on, not native

### Platform Limitations

- **Graph rigidity vs. agent flexibility** — graph-based agents are deterministic but inflexible; they can't dynamically create new branches at runtime
- **Block ecosystem fragmentation** — the quality and reliability of community blocks varies significantly
- **Learning curve** — while the UI is visual, understanding how to properly wire complex graphs requires significant experimentation
- **Sub-agent blocks are opaque** — debugging failures inside nested agent loops is difficult
- **Hosted platform data privacy** — running agents on autogpt.com involves sending data to their servers
- **Self-hosting complexity** — the Docker Compose stack requires PostgreSQL and Redis, adding operational overhead vs. simpler frameworks
- **No native multi-agent mesh** — there is no pub/sub or message bus between agents; communication is strictly parent → child
- **LLM provider coupling** — despite claiming multi-provider support, much tooling is optimized for OpenAI

---

## AutoGPT Code Examples

### Classic AutoGPT Agent Configuration

```yaml
# ai_settings.yaml
ai_name: ResearcherGPT
ai_role: >
  An autonomous research assistant that gathers information,
  analyzes it, and produces structured reports.
ai_goals:
  - Research the top 5 Python web frameworks and their 2024 adoption stats
  - Compare performance benchmarks for each framework
  - Write a comprehensive comparison report and save it as web_frameworks_report.md
  - Notify when complete by printing TASK COMPLETE
api_budget: 5.00  # max USD to spend on API calls
```

```bash
# Run classic AutoGPT
python -m autogpt --ai-settings ai_settings.yaml --skip-news
```

### AutoGPT Forge Custom Agent

```python
from forge.sdk import (
    Agent, AgentDB, ForgeLogger,
    Step, Task, TaskRequestBody, StepRequestBody,
    chat_completion_request, create_chat_message
)

LOG = ForgeLogger(__name__)

class ResearchAgent(Agent):
    def __init__(self, database: AgentDB, workspace: Workspace):
        super().__init__(database, workspace)
        self.ability_registry = AbilityRegistry(agent=self)

    async def create_task(self, task_request: TaskRequestBody) -> Task:
        task = await self.db.create_task(
            input=task_request.input,
            additional_input=task_request.additional_input,
        )
        LOG.info(f"Task created: {task.task_id} — {task.input}")
        return task

    async def execute_step(self, task_id: str, step_request: StepRequestBody) -> Step:
        task = await self.db.get_task(task_id)
        steps = await self.db.list_steps(task_id)

        # Build prompt with task history
        messages = [
            create_chat_message("system", SYSTEM_PROMPT),
            create_chat_message("user", f"Task: {task.input}"),
        ]
        for s in steps:
            if s.output:
                messages.append(create_chat_message("assistant", s.output))

        # Call LLM
        response = await chat_completion_request(
            model="gpt-4o",
            messages=messages,
            functions=self.ability_registry.get_function_schemas(),
        )

        # Parse function call
        fn_call = response.choices[0].message.function_call
        ability_name = fn_call.name
        ability_args = json.loads(fn_call.arguments)

        # Execute ability (tool)
        result = await self.ability_registry.run_ability(
            task_id, ability_name, **ability_args
        )

        # Determine if task is complete
        is_last = ability_name == "finish"

        step = await self.db.create_step(
            task_id=task_id,
            input=step_request,
            is_last=is_last,
            additional_output={"ability": ability_name, "result": result},
        )
        step.output = str(result)
        return step
```

### AutoGPT Platform: Creating an Agent via API

```python
import httpx
import json

BASE_URL = "http://localhost:8000"
API_KEY = "your-api-key"

# Define an agent graph
agent_graph = {
    "name": "Web Research Summarizer",
    "description": "Searches the web and summarizes results",
    "nodes": [
        {
            "id": "input-1",
            "block_id": "blocks.basic.input_block",
            "input_default": {"name": "query", "description": "Search query"},
        },
        {
            "id": "search-1",
            "block_id": "blocks.search.get_request",
            "input_default": {
                "url": "https://api.search.com/search",
                "headers": {"Authorization": "Bearer SEARCH_KEY"},
            },
        },
        {
            "id": "llm-1",
            "block_id": "blocks.ai.llm_call_block",
            "input_default": {
                "model": "gpt-4o",
                "sys_prompt": "You are a research assistant. Summarize the search results concisely.",
            },
        },
        {
            "id": "output-1",
            "block_id": "blocks.basic.output_block",
            "input_default": {"name": "summary", "description": "Research summary"},
        },
    ],
    "links": [
        {"source_id": "input-1", "source_name": "result", "sink_id": "search-1", "sink_name": "params"},
        {"source_id": "search-1", "source_name": "response", "sink_id": "llm-1", "sink_name": "prompt"},
        {"source_id": "llm-1", "source_name": "response", "sink_id": "output-1", "sink_name": "value"},
    ],
}

headers = {"Authorization": f"Bearer {API_KEY}", "Content-Type": "application/json"}

# Create agent graph
with httpx.Client() as client:
    # Create the agent
    resp = client.post(f"{BASE_URL}/api/v1/graphs", json=agent_graph, headers=headers)
    agent_id = resp.json()["id"]
    print(f"Created agent: {agent_id}")

    # Execute it
    run_resp = client.post(
        f"{BASE_URL}/api/v1/graphs/{agent_id}/execute",
        json={"input_data": {"query": "latest AI agent frameworks 2025"}},
        headers=headers,
    )
    run_id = run_resp.json()["id"]
    print(f"Started run: {run_id}")

    # Poll for completion
    import time
    while True:
        status_resp = client.get(
            f"{BASE_URL}/api/v1/graphs/{agent_id}/executions/{run_id}",
            headers=headers,
        )
        execution = status_resp.json()
        if execution["status"] in ("COMPLETED", "FAILED"):
            print(f"Run {execution['status']}")
            print(f"Output: {json.dumps(execution.get('outputs', {}), indent=2)}")
            break
        time.sleep(2)
```

### Classic AutoGPT-style Loop (Minimal Python Implementation)

```python
"""
Minimal implementation illustrating the classic AutoGPT loop concept.
Not the actual AutoGPT source, but captures the core pattern.
"""
from openai import OpenAI
import json

client = OpenAI()

SYSTEM_PROMPT = """You are an autonomous AI agent. You have access to tools.
At each step, respond with JSON:
{
    "thoughts": "your reasoning",
    "plan": "next steps",
    "command": {
        "name": "tool_name",
        "args": {"arg1": "value1"}
    }
}
Available commands: web_search, write_file, read_file, finish"""

def web_search(query: str) -> str:
    # Stub — would call Serper/Bing API
    return f"[Search results for: {query}]"

def write_file(filename: str, content: str) -> str:
    with open(filename, "w") as f:
        f.write(content)
    return f"Written {len(content)} chars to {filename}"

def finish(reason: str) -> str:
    return f"FINISHED: {reason}"

TOOLS = {"web_search": web_search, "write_file": write_file, "finish": finish}

def run_agent(goals: list[str], max_cycles: int = 20):
    history = []
    goals_str = "\n".join(f"- {g}" for g in goals)

    for cycle in range(max_cycles):
        print(f"\n--- Cycle {cycle + 1} ---")

        messages = [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": f"Goals:\n{goals_str}"},
            *history,
        ]

        response = client.chat.completions.create(
            model="gpt-4o",
            messages=messages,
            response_format={"type": "json_object"},
        )

        raw = response.choices[0].message.content
        action = json.loads(raw)

        print(f"Thoughts: {action.get('thoughts', '')}")
        print(f"Plan: {action.get('plan', '')}")
        cmd = action.get("command", {})
        print(f"Command: {cmd.get('name')} {cmd.get('args', {})}")

        # Execute command
        tool_fn = TOOLS.get(cmd["name"])
        if not tool_fn:
            result = f"Unknown command: {cmd['name']}"
        else:
            result = tool_fn(**cmd.get("args", {}))

        print(f"Result: {result}")

        # Record in history
        history.append({"role": "assistant", "content": raw})
        history.append({"role": "user", "content": f"Command result: {result}"})

        if cmd["name"] == "finish":
            print(f"\nAgent finished after {cycle + 1} cycles.")
            return result

    print("Max cycles reached.")
    return None

# Run it
run_agent([
    "Research the top 3 Python async frameworks",
    "Write a comparison to async_frameworks.md",
])
```

---

# Comparison Summary

| Dimension | CrewAI | AutoGPT |
|---|---|---|
| **Primary paradigm** | Role-based multi-agent crews | Goal-directed autonomous agent / Graph pipelines |
| **Agent coordination** | Sequential or hierarchical via orchestrator | Dataflow (graph) or single-agent self-direction |
| **Ease of use** | Python API; moderate learning curve | Visual builder (Platform) or config file (classic) |
| **Task structure** | Explicit Task objects with expected outputs | Goals (classic) or graph nodes (platform) |
| **Structured output** | Native Pydantic support | Manual parsing required (classic); block outputs (platform) |
| **Memory** | SQLite long-term + vector short-term | Vector store (classic) + PostgreSQL (platform) |
| **Multi-agent support** | Native (hierarchical process) | Sub-agent blocks (platform); none (classic) |
| **Deployment** | Python library / CLI / SaaS | Docker Compose / SaaS / local script |
| **Production readiness** | Growing; still primarily research/automation | Platform more production-ready; classic is prototype-grade |
| **No-code interface** | CrewAI Enterprise UI | AutoGPT Platform visual builder |
| **Open source** | Yes (core framework) | Yes (platform and classic) |
| **Best for** | Structured multi-role workflows with clear deliverables | Open-ended automation; visual pipeline building |
| **Weakness** | No real-time agent messaging; context window limits | Classic: unpredictable; Platform: less flexible than code |
| **LLM support** | Via LiteLLM (broad) | OpenAI-primary; others supported |
| **Community** | Active; growing enterprise adoption | Large early community; platform ecosystem growing |

### When to Choose CrewAI
- You need multiple specialized agents collaborating on a structured deliverable
- You want code-first control over agent behavior and output schemas
- Your workflow maps naturally to a pipeline with defined roles
- You need reliable, reproducible output (Pydantic schemas)

### When to Choose AutoGPT Platform
- You want a visual no-code/low-code builder for agent workflows
- You need event-driven or scheduled agent automation
- You want an open marketplace of reusable components
- You are building production integrations with third-party services (Slack, GitHub, Notion, etc.)

### When to Use Classic AutoGPT Style
- Research and experimentation with autonomous agent behavior
- Open-ended tasks where the path to completion is not known in advance
- Educational purposes to understand the foundational agent loop pattern

---

*Documentation compiled from training knowledge as of 2025. CrewAI version ~0.80+, AutoGPT Platform version ~0.5.x.*

---

# AI Agent Platforms: LangGraph & AgentOps — Comprehensive Documentation

---

## Table of Contents

1. [LangGraph (by LangChain)](#langgraph-by-langchain)
   - [Overview](#langgraph-overview)
   - [Core Architecture](#langgraph-core-architecture)
   - [State Management](#state-management)
   - [Nodes](#nodes)
   - [Edges and Routing](#edges-and-routing)
   - [Tasks and Projects](#langgraph-tasks-and-projects)
   - [Agent Communication and Coordination](#langgraph-agent-communication-and-coordination)
   - [Agent Types and Roles](#langgraph-agent-types-and-roles)
   - [Task Execution and Tracking](#langgraph-task-execution-and-tracking)
   - [Database and Storage](#langgraph-database-and-storage)
   - [Deployment Model](#langgraph-deployment-model)
   - [Unique Features](#langgraph-unique-features)
   - [Limitations](#langgraph-limitations)
   - [Code Examples](#langgraph-code-examples)

2. [AgentOps](#agentops)
   - [Overview](#agentops-overview)
   - [Core Architecture](#agentops-core-architecture)
   - [Session Tracking](#session-tracking)
   - [Tasks and Projects](#agentops-tasks-and-projects)
   - [Agent Communication and Coordination](#agentops-agent-communication-and-coordination)
   - [Agent Types and Roles](#agentops-agent-types-and-roles)
   - [Task Execution and Tracking](#agentops-task-execution-and-tracking)
   - [Database and Storage](#agentops-database-and-storage)
   - [Deployment Model](#agentops-deployment-model)
   - [Unique Features](#agentops-unique-features)
   - [Limitations](#agentops-limitations)
   - [Code Examples](#agentops-code-examples)

3. [Side-by-Side Comparison](#side-by-side-comparison)

---

---

# LangGraph (by LangChain)

## LangGraph Overview

LangGraph is an open-source framework built on top of LangChain for creating stateful, multi-actor applications with language models. It extends LangChain's capabilities by introducing a graph-based execution model where agents and tools are represented as nodes connected by edges. The fundamental insight behind LangGraph is that complex agentic workflows require explicit state management, branching logic, and cycles — none of which are naturally expressed as simple linear chains.

LangGraph was designed to solve the "agent reliability" problem: how do you build agents that can handle long-running tasks, recover from failures, pause for human review, and maintain consistent state across many steps? The answer is a stateful graph that persists at every step.

**Key design principles:**
- State is a first-class citizen — every step reads from and writes to an explicit state object
- The graph structure is inspectable, debuggable, and serializable
- Cycles are supported — agents can loop back to previous nodes based on conditions
- Human-in-the-loop is a first-class concern, not an afterthought
- Checkpointing allows replay, time-travel, and fault tolerance

---

## LangGraph Core Architecture

LangGraph models agentic workflows as a **directed graph** (which may contain cycles, making it technically a directed graph with possible cycles rather than a strict DAG). The four fundamental primitives are:

### StateGraph

The `StateGraph` is the top-level container. It defines:
- The **state schema** (what data flows through the graph)
- The **nodes** (processing units — agents, tools, functions)
- The **edges** (connections between nodes, which may be conditional)
- The **entry point** (where execution begins)
- The **terminal nodes** (where execution ends)

```
StateGraph
├── State Schema (TypedDict or Pydantic)
├── Nodes (functions or runnables)
├── Edges (fixed or conditional)
├── Checkpointer (optional persistence layer)
└── Compiled Graph (executable artifact)
```

When you call `graph.compile()`, LangGraph validates the graph structure, resolves entry/exit points, and returns a `CompiledGraph` — a Runnable that can be invoked, streamed, or batched.

### Graph Compilation Pipeline

```
Define StateGraph
    → add_node() calls
    → add_edge() / add_conditional_edges() calls
    → set_entry_point() / set_finish_point()
    → compile(checkpointer=..., interrupt_before=..., interrupt_after=...)
    → CompiledGraph (Runnable)
```

---

## State Management

State in LangGraph is the single most important concept. It is a **typed dictionary** (using Python's `TypedDict` or Pydantic `BaseModel`) that is passed through every node. Each node receives the current state, performs its computation, and returns an update — a partial dictionary of keys to modify.

### State Reducers

LangGraph supports **reducer functions** on state keys. By default, a key is overwritten when a node returns a new value. But you can attach a reducer to define how updates are merged:

```python
from typing import Annotated
from operator import add
from typing_extensions import TypedDict

class AgentState(TypedDict):
    messages: Annotated[list, add]       # messages are appended, not replaced
    context: str                          # context is overwritten
    iteration_count: Annotated[int, add]  # counts accumulate
    final_answer: str                     # overwritten when set
```

The `Annotated[list, add]` pattern is extremely common for message history: every node that appends to the conversation simply returns `{"messages": [new_message]}` and the reducer handles the merge.

### State Channels

Internally, LangGraph implements state as **channels** — each key in the state dict is a channel with its own update semantics. The built-in channel types are:

| Channel Type | Behavior | Use Case |
|---|---|---|
| `LastValue` | Overwrites with latest value | Single scalar fields |
| `BinaryOperatorAggregate` | Applies a binary operator (e.g., `add`) | Accumulating lists or counts |
| `Topic` | Pub/sub for multi-producer keys | Parallel branch aggregation |
| `EphemeralValue` | Cleared after each step | Temporary pass-through data |

---

## Nodes

A **node** is any Python callable (function or async function) that:
1. Accepts the current state (or a subset of it)
2. Performs some computation (calls an LLM, runs a tool, transforms data)
3. Returns a dictionary of state updates

Nodes are the units of work. They can be:
- **LLM calls** — invoke a language model with messages from state
- **Tool executors** — run tools (web search, code interpreter, database queries)
- **Routers** — inspect state and return routing decisions
- **Human interaction nodes** — pause and await human input
- **Sub-graph nodes** — embed an entire compiled graph as a node

```python
def call_llm(state: AgentState) -> dict:
    response = llm.invoke(state["messages"])
    return {"messages": [response]}

def execute_tools(state: AgentState) -> dict:
    last_message = state["messages"][-1]
    tool_results = tool_executor.batch(last_message.tool_calls)
    return {"messages": tool_results}
```

### Special Nodes

- `START` — the implicit entry node, always the source of the first edge
- `END` — the implicit terminal node, signals graph completion
- `__start__` / `__end__` — internal string constants used in edge definitions

---

## Edges and Routing

Edges define the **control flow** of the graph. There are three types:

### 1. Normal Edges

Unconditional transitions from one node to another:

```python
graph.add_edge("node_a", "node_b")
```

After `node_a` completes, execution always proceeds to `node_b`.

### 2. Conditional Edges

Edges where the next node is determined at runtime by a routing function:

```python
def should_continue(state: AgentState) -> str:
    last_message = state["messages"][-1]
    if last_message.tool_calls:
        return "tools"
    return "end"

graph.add_conditional_edges(
    "agent",
    should_continue,
    {
        "tools": "tool_executor",
        "end": END,
    }
)
```

The routing function returns a string key, which is mapped to the next node. This is how agents implement loops: the agent node produces a tool call, the tool executor runs it, and control returns to the agent node.

### 3. Entry and Finish Points

```python
graph.set_entry_point("agent")       # first node after START
graph.set_finish_point("final_node") # last node before END
```

Or equivalently:
```python
graph.add_edge(START, "agent")
graph.add_edge("final_node", END)
```

### Fan-out and Fan-in (Parallel Execution)

LangGraph supports **parallel node execution** using fan-out edges. When multiple edges leave the same node, those target nodes execute concurrently (using asyncio or threads depending on the runner):

```python
# Fan-out: after "router", run "search" and "calculator" in parallel
graph.add_edge("router", "search")
graph.add_edge("router", "calculator")

# Fan-in: after both complete, aggregate results in "synthesizer"
graph.add_edge("search", "synthesizer")
graph.add_edge("calculator", "synthesizer")
```

---

## LangGraph Tasks and Projects

LangGraph does not have a native "project" concept at the framework level — projects are an organizational concern addressed by LangGraph Platform (the cloud/server layer). At the framework level, the unit of work is a **graph invocation**, which maps to a **thread** in the platform layer.

### Threads

A **thread** represents a single, persistent conversation or task execution. It has:
- A unique `thread_id`
- A full history of all states (one per step, if checkpointing is enabled)
- A current state that can be read and written
- An optional `run_id` for each invocation

### Runs

A **run** is a single invocation of the graph within a thread. Multiple runs can occur on the same thread (continuing a conversation, for example). Each run:
- Starts from the latest checkpoint in the thread (or from scratch for the first run)
- Produces a new checkpoint at every step
- Can be a **background run** (async, fire-and-forget with a run ID for polling)
- Can be a **streaming run** (events are streamed back to the caller)

### Assistants

In LangGraph Platform, an **assistant** is a saved, versioned configuration of a graph:
- Which graph definition to use
- What configuration values to pass (model name, temperature, tool set, etc.)
- Metadata and a human-readable name

Multiple assistants can share the same underlying graph with different configurations, enabling easy A/B testing and multi-tenant deployments.

---

## LangGraph Agent Communication and Coordination

### Single-Agent Communication (ReAct Loop)

The most basic communication pattern is the **ReAct loop** within a single agent graph:

```
State.messages (list) is the communication channel
Agent node reads messages, produces a response with tool calls
Tool node executes tool calls, produces ToolMessage results
Agent node reads ToolMessage results, decides what to do next
```

All communication happens through the shared state — specifically the `messages` list. This is the canonical LangChain/OpenAI message format: `HumanMessage`, `AIMessage`, `ToolMessage`, `SystemMessage`.

### Multi-Agent Communication

For multi-agent systems, LangGraph supports several coordination patterns:

#### 1. Supervisor Pattern

A **supervisor agent** receives tasks and delegates to specialized sub-agents:

```
Supervisor Node
    (conditional edge based on task type)
    ├── Research Agent Node
    ├── Code Agent Node
    └── Writing Agent Node
    (all route back to supervisor)
Supervisor evaluates results, decides to continue or finish
```

The supervisor maintains the shared state and each sub-agent reads from and writes to that state. Communication is implicit through state mutation.

#### 2. Hierarchical Agent Networks

Sub-graphs can be compiled and embedded as nodes in a parent graph. This creates **hierarchical agent trees**:

```python
# Define sub-agent graph
research_graph = StateGraph(ResearchState)
# ... add nodes and edges ...
research_agent = research_graph.compile()

# Embed as a node in the parent graph
parent_graph.add_node("research", research_agent)
```

The sub-graph node receives the parent state (or a projection of it), runs to completion, and returns updates to the parent state.

#### 3. Message Passing Between Agents

For more explicit multi-agent communication, agents can communicate via structured messages in the state:

```python
class MultiAgentState(TypedDict):
    task_queue: Annotated[list[Task], add]       # tasks submitted by agents
    completed_tasks: Annotated[list[Result], add] # results from agents
    messages: Annotated[list[BaseMessage], add]   # conversation history
    agent_scratchpad: dict                        # per-agent working memory
```

#### 4. Handoff Pattern (Command)

Agents can explicitly "hand off" to other agents by returning a structured command:

```python
from langgraph.types import Command

def research_agent(state):
    # ... do research ...
    return Command(
        goto="writing_agent",
        update={"research_results": results, "messages": [AIMessage(...)]}
    )
```

The `Command` type allows a node to both update state AND specify the next node, bypassing the normal edge routing.

---

## LangGraph Agent Types and Roles

LangGraph does not prescribe agent types — you define them. However, well-established patterns have emerged:

### By Architecture

| Agent Type | Description | Pattern |
|---|---|---|
| **ReAct Agent** | Reasoning + Acting loop | `agent → tools → agent` cycle |
| **Plan-and-Execute Agent** | Creates plan first, then executes steps | `planner → executor → evaluator` |
| **Reflexion Agent** | Self-critiques and revises | `actor → evaluator → revisor → actor` |
| **LATS Agent** | Language Agent Tree Search — explores multiple branches | Tree-shaped graph with backtracking |
| **Self-RAG Agent** | Retrieval with self-evaluation of retrieved docs | `retrieve → grade → generate → grade_output` |
| **Storm Agent** | Multi-perspective research synthesis | Supervisor with many parallel researcher agents |

### By Role in Multi-Agent Systems

| Role | Responsibility |
|---|---|
| **Orchestrator / Supervisor** | Routes tasks to sub-agents, aggregates results, decides completion |
| **Researcher** | Retrieves and synthesizes information from external sources |
| **Coder** | Writes, executes, and debugs code |
| **Critic / Evaluator** | Assesses quality of outputs, decides if rework is needed |
| **Executor** | Runs tools, APIs, or shell commands |
| **Planner** | Decomposes high-level goals into sub-tasks |
| **Human Proxy** | Represents a human interrupt point |

### Prebuilt Agents in LangGraph

LangGraph provides several prebuilt agent constructors:

```python
from langgraph.prebuilt import create_react_agent

agent = create_react_agent(
    model=llm,
    tools=[search_tool, calculator_tool],
    state_modifier="You are a helpful research assistant.",
    checkpointer=MemorySaver()
)
```

This creates a full ReAct agent graph without manually defining nodes and edges.

---

## LangGraph Task Execution and Tracking

### Execution Modes

LangGraph supports multiple invocation patterns:

#### 1. Synchronous Invocation
```python
result = graph.invoke({"messages": [HumanMessage(content="What is 2+2?")]})
```
Blocks until the graph reaches END or an interrupt.

#### 2. Asynchronous Invocation
```python
result = await graph.ainvoke({"messages": [HumanMessage(content="What is 2+2?")]})
```

#### 3. Streaming
```python
# Stream state updates at each step
for chunk in graph.stream(input, config, stream_mode="updates"):
    print(chunk)

# Stream all events including LLM tokens
async for event in graph.astream_events(input, config, version="v2"):
    print(event)
```

Stream modes:
- `"values"` — full state after each node
- `"updates"` — partial state updates from each node
- `"messages"` — individual LLM tokens as they are generated
- `"debug"` — detailed internal events for debugging

#### 4. Batch Invocation
```python
results = graph.batch([input1, input2, input3])
```

### Step-Level Tracking

Every step of a compiled graph produces a **checkpoint** when a checkpointer is configured. Each checkpoint contains:
- The full state at that step
- The node that just executed
- Metadata (timestamps, run IDs)
- The pending tasks (what comes next)

This gives you a complete audit trail of every state transition.

### Interrupts and Human-in-the-Loop

Execution can be paused at specific nodes:

```python
compiled = graph.compile(
    checkpointer=MemorySaver(),
    interrupt_before=["human_review"],   # pause BEFORE this node runs
    interrupt_after=["risky_action"],    # pause AFTER this node runs
)
```

When an interrupt fires, `invoke()` returns early with the current state. The caller can inspect the state, optionally modify it, and resume:

```python
# Invoke until interrupt
state = graph.invoke(input, config)

# Inspect state, perhaps present to a human
print(state["draft"])

# Resume from interrupt (with optional state update)
graph.update_state(config, {"draft": revised_draft})
final_state = graph.invoke(None, config)  # None input = resume
```

---

## LangGraph Database and Storage

### Checkpointers

The checkpointer is the persistence layer. LangGraph ships with:

| Checkpointer | Backend | Use Case |
|---|---|---|
| `MemorySaver` | In-process Python dict | Development, testing, single-process |
| `SqliteSaver` | SQLite file | Local persistence, simple deployments |
| `AsyncSqliteSaver` | SQLite (async) | Async applications |
| `PostgresSaver` | PostgreSQL (psycopg2) | Production, multi-process |
| `AsyncPostgresSaver` | PostgreSQL (psycopg3 async) | High-throughput production |

Third-party checkpointers also exist for Redis, MongoDB, and other backends.

### What Gets Persisted

Each checkpoint stores:
```json
{
  "thread_id": "uuid",
  "checkpoint_id": "uuid",
  "parent_checkpoint_id": "uuid | null",
  "ts": "2025-01-01T00:00:00Z",
  "channel_values": {},
  "channel_versions": {},
  "versions_seen": {},
  "pending_sends": [],
  "metadata": {}
}
```

- `channel_values` — the full state snapshot
- `channel_versions` — version vector for conflict detection
- `versions_seen` — which node has seen which version
- `pending_sends` — queued messages for next step
- `metadata` — run_id, source, step number, etc.

### Store (Long-Term Memory)

Separate from checkpointers, LangGraph provides a **Store** abstraction for long-term memory that persists across threads:

```python
from langgraph.store.memory import InMemoryStore
from langgraph.store.postgres import AsyncPostgresStore

store = InMemoryStore()

# In a node, inject the store
def agent_node(state, store):
    # Read user preferences across all their conversations
    user_prefs = store.get(("users", state["user_id"]), "preferences")
    # Write new memories
    store.put(("users", state["user_id"]), "preferences", updated_prefs)
```

The Store uses a **namespace + key** addressing scheme, similar to a key-value store but with namespace hierarchies for organization.

---

## LangGraph Deployment Model

### 1. Library Mode (No Platform)

The simplest deployment: import LangGraph, compile your graph, call it from your own application. You own the server, the API layer, everything. LangGraph just provides the graph execution engine.

```python
# Your FastAPI app
@app.post("/chat")
async def chat(message: str, thread_id: str):
    config = {"configurable": {"thread_id": thread_id}}
    result = await graph.ainvoke({"messages": [HumanMessage(message)]}, config)
    return result
```

### 2. LangGraph Platform (Self-Hosted or Cloud)

LangGraph Platform is an opinionated deployment layer that wraps your graph with:
- A REST API (standardized endpoints for threads, runs, assistants, crons)
- A WebSocket streaming interface
- A built-in PostgreSQL checkpointer
- Background task processing (runs execute in background workers)
- Horizontal scaling
- LangSmith integration for observability

**Deployment flavors:**

| Option | Description |
|---|---|
| **LangGraph Cloud** | Fully managed, hosted by LangChain. Deploy from GitHub, get an HTTPS endpoint. |
| **Self-Hosted Lite** | Docker Compose deployment you run on your own infrastructure. Free tier. |
| **Self-Hosted Enterprise** | Kubernetes/Helm deployment for high availability. Licensed. |

### LangGraph Platform API Endpoints

```
POST   /threads                           — create a new thread
GET    /threads/{thread_id}               — get thread state
POST   /threads/{thread_id}/runs          — start a run on a thread
GET    /threads/{thread_id}/runs/{run_id} — check run status
POST   /threads/{thread_id}/runs/stream   — stream a run
DELETE /threads/{thread_id}               — delete a thread
POST   /assistants                        — create/save an assistant config
POST   /store/put                         — write to long-term store
GET    /store/get                         — read from long-term store
POST   /runs/crons                        — schedule recurring runs
```

### LangGraph Server (langgraph.json)

To deploy with LangGraph Platform, you define a `langgraph.json` manifest:

```json
{
  "dependencies": ["."],
  "graphs": {
    "my_agent": "./agent.py:graph"
  },
  "env": ".env",
  "python_version": "3.11",
  "pip_config_file": "pyproject.toml"
}
```

The CLI then handles packaging and deployment:
```bash
langgraph build   # build Docker image
langgraph up      # start locally with Docker Compose
langgraph deploy  # deploy to LangGraph Cloud
```

---

## LangGraph Unique Features

### 1. Time-Travel and State Replay

Because every state is checkpointed, you can navigate the history of any thread:

```python
# Get all checkpoints for a thread
checkpoints = list(graph.get_state_history(config))

# Replay from a specific checkpoint
old_config = {"configurable": {"thread_id": "...", "checkpoint_id": "..."}}
graph.invoke(None, old_config)  # re-runs from that point
```

This is invaluable for debugging: reproduce a failure exactly, then fork the execution to test a fix.

### 2. State Forking

From any checkpoint, you can fork the execution into a new thread:

```python
# Fork thread at a specific point
new_config = {"configurable": {"thread_id": "new-thread-id"}}
graph.update_state(new_config, state_at_checkpoint)
# Now run the new thread with different input or logic
```

### 3. Human-in-the-Loop at Multiple Levels

- **Interrupt before/after specific nodes** — pause, inspect, approve
- **Dynamic interrupts within a node** — `raise NodeInterrupt("reason")` from inside a node when conditions warrant
- **Update state during interrupt** — modify any state value before resuming
- **Reject/rollback** — do not resume, treat the run as failed

### 4. Streaming at Multiple Granularities

LangGraph's streaming is unusually fine-grained:
- Stream full state snapshots between nodes
- Stream individual state key updates from nodes
- Stream individual LLM tokens as they are generated
- Stream all internal events (node start/end, tool calls, etc.)

This enables real-time UIs that show exactly what the agent is doing at the character level.

### 5. Subgraphs and Composability

Graphs are composable: a compiled graph is a Runnable and can be used as a node in another graph. This allows building complex agent systems from smaller, testable, independently deployable pieces.

### 6. Map-Reduce Patterns

LangGraph supports explicit map-reduce workflows via `Send`:

```python
from langgraph.types import Send

def map_step(state):
    # Fan out: create one task per item
    return [Send("process_item", {"item": item}) for item in state["items"]]

graph.add_conditional_edges("map_step", map_step)
# Each "process_item" call runs independently, results are reduced back
```

### 7. Cron/Scheduled Runs

Via LangGraph Platform, you can schedule recurring graph runs:

```python
client.runs.crons.create(
    assistant_id="my_agent",
    schedule="0 * * * *",
    input={"task": "daily_report"}
)
```

### 8. Double-Texting Handling

LangGraph Platform handles the case where a user sends a message while a run is already in progress. Configurable policies:
- `"reject"` — reject the new message
- `"enqueue"` — queue the new message to run after current completes
- `"interrupt"` — interrupt the current run and start fresh
- `"rollback"` — rollback the current run as if it never happened

---

## LangGraph Limitations

1. **Learning curve** — The graph model, state channels, reducers, checkpointers, and streaming modes constitute a significant conceptual surface area. Newcomers often struggle with the indirection.

2. **Debugging complexity** — While time-travel helps, a long-running graph with many nodes and complex state can be difficult to reason about. LangSmith is essentially required for production debugging.

3. **Python-first** — LangGraph has a JavaScript/TypeScript port (`@langchain/langgraph`) but the Python library is significantly more mature. Java, Go, and other languages are not supported.

4. **Checkpointer performance** — In high-throughput scenarios, checkpointing every step can become a bottleneck, particularly with large state objects (e.g., long message histories). You must be thoughtful about what you store in state.

5. **LangGraph Platform cost** — The managed cloud product carries significant cost for high-volume production workloads. Self-hosted options exist but require operational overhead.

6. **No native UI** — LangGraph itself has no built-in UI. LangSmith provides observability but it is a separate product. Building operator dashboards requires custom work.

7. **Tight LangChain coupling** — While you can use LangGraph with any LLM, it works best with LangChain abstractions (`ChatOpenAI`, LangChain tools, etc.). Using raw SDKs adds friction.

8. **Async complexity** — Mixing sync and async nodes in the same graph requires care. The async execution model can produce subtle bugs in complex multi-agent scenarios.

9. **Limited cross-language agent communication** — Multi-agent systems built in LangGraph cannot natively communicate with agents built in other frameworks without custom glue code.

10. **State schema rigidity** — Changing the state schema after deployment can break existing checkpoints. Schema migration is not built-in.

---

## LangGraph Code Examples

### Example 1: Basic ReAct Agent with Persistence

```python
from typing import Annotated
from typing_extensions import TypedDict
from langchain_openai import ChatOpenAI
from langchain_core.messages import BaseMessage
from langgraph.graph import StateGraph, START, END
from langgraph.graph.message import add_messages
from langgraph.prebuilt import ToolNode, tools_condition
from langgraph.checkpoint.memory import MemorySaver
from langchain_community.tools.tavily_search import TavilySearchResults

# --- State ---
class State(TypedDict):
    messages: Annotated[list[BaseMessage], add_messages]

# --- Tools ---
search_tool = TavilySearchResults(max_results=3)
tools = [search_tool]

# --- LLM ---
llm = ChatOpenAI(model="gpt-4o", temperature=0)
llm_with_tools = llm.bind_tools(tools)

# --- Nodes ---
def agent_node(state: State) -> dict:
    response = llm_with_tools.invoke(state["messages"])
    return {"messages": [response]}

# --- Graph ---
graph_builder = StateGraph(State)
graph_builder.add_node("agent", agent_node)
graph_builder.add_node("tools", ToolNode(tools))

graph_builder.add_edge(START, "agent")
graph_builder.add_conditional_edges("agent", tools_condition)
graph_builder.add_edge("tools", "agent")

# --- Compile with checkpointing ---
memory = MemorySaver()
graph = graph_builder.compile(checkpointer=memory)

# --- Invoke ---
config = {"configurable": {"thread_id": "user-123"}}
result = graph.invoke(
    {"messages": [{"role": "user", "content": "What is the current price of Bitcoin?"}]},
    config
)
print(result["messages"][-1].content)

# --- Continue the conversation on the same thread ---
result2 = graph.invoke(
    {"messages": [{"role": "user", "content": "And Ethereum?"}]},
    config  # same thread_id preserves history
)
```

### Example 2: Multi-Agent Supervisor

```python
from typing import Literal
from langchain_openai import ChatOpenAI
from langchain_core.messages import HumanMessage
from langgraph.graph import StateGraph, MessagesState, START, END
from langgraph.types import Command

llm = ChatOpenAI(model="gpt-4o")

# --- Specialized agents ---
def researcher_agent(state: MessagesState) -> Command[Literal["supervisor"]]:
    system = "You are a research expert. Search for relevant information."
    response = llm.invoke([{"role": "system", "content": system}] + state["messages"])
    return Command(
        update={"messages": [response]},
        goto="supervisor"
    )

def writer_agent(state: MessagesState) -> Command[Literal["supervisor"]]:
    system = "You are a professional writer. Write clear, engaging content."
    response = llm.invoke([{"role": "system", "content": system}] + state["messages"])
    return Command(
        update={"messages": [response]},
        goto="supervisor"
    )

# --- Supervisor ---
def supervisor(state: MessagesState) -> Command[Literal["researcher", "writer", "__end__"]]:
    system = """You are a supervisor managing a researcher and a writer.
    Given the conversation, decide who should act next or if the task is done.
    Reply with exactly one of: RESEARCHER, WRITER, FINISH"""
    response = llm.invoke([{"role": "system", "content": system}] + state["messages"])
    decision = response.content.strip().upper()

    if decision == "FINISH":
        return Command(goto=END)
    elif decision == "RESEARCHER":
        return Command(goto="researcher")
    else:
        return Command(goto="writer")

# --- Build graph ---
graph = StateGraph(MessagesState)
graph.add_node("supervisor", supervisor)
graph.add_node("researcher", researcher_agent)
graph.add_node("writer", writer_agent)
graph.add_edge(START, "supervisor")

compiled = graph.compile()

# --- Run ---
result = compiled.invoke({
    "messages": [HumanMessage("Write a short article about quantum computing")]
})
```

### Example 3: Human-in-the-Loop with State Update

```python
from langgraph.graph import StateGraph, START, END
from langgraph.checkpoint.memory import MemorySaver
from typing_extensions import TypedDict

class ReviewState(TypedDict):
    draft: str
    feedback: str
    final: str
    approved: bool

def write_draft(state: ReviewState) -> dict:
    draft = llm.invoke("Write a marketing email about our product.").content
    return {"draft": draft}

def human_review(state: ReviewState) -> dict:
    # This node will be interrupted before it runs.
    # The node itself does nothing; the human modifies state externally.
    return {}

def revise_or_finalize(state: ReviewState) -> dict:
    if state.get("approved"):
        return {"final": state["draft"]}
    else:
        revised = llm.invoke(
            f"Revise this draft: {state['draft']}\nFeedback: {state['feedback']}"
        ).content
        return {"draft": revised, "approved": False}

def route_after_review(state: ReviewState) -> str:
    if state.get("approved"):
        return "finalize"
    return "write_draft"

graph = StateGraph(ReviewState)
graph.add_node("write_draft", write_draft)
graph.add_node("human_review", human_review)
graph.add_node("revise_or_finalize", revise_or_finalize)

graph.add_edge(START, "write_draft")
graph.add_edge("write_draft", "human_review")
graph.add_conditional_edges("human_review", route_after_review, {
    "finalize": END,
    "write_draft": "write_draft"
})

memory = MemorySaver()
compiled = graph.compile(
    checkpointer=memory,
    interrupt_before=["human_review"]
)

config = {"configurable": {"thread_id": "review-task-1"}}

# Start: runs until interrupt
state = compiled.invoke({"draft": "", "approved": False}, config)
print("Draft for review:", state["draft"])

# Human approves
compiled.update_state(config, {"approved": True, "feedback": ""})

# Resume
final_state = compiled.invoke(None, config)
print("Final approved:", final_state["final"])
```

### Example 4: Map-Reduce with Send

```python
from typing import Annotated
from operator import add
from typing_extensions import TypedDict
from langgraph.types import Send
from langgraph.graph import StateGraph, START, END

class OverallState(TypedDict):
    documents: list[str]
    summaries: Annotated[list[str], add]  # reducer: summaries accumulate
    final_synthesis: str

class DocumentState(TypedDict):
    document: str

def split_documents(state: OverallState):
    # Fan out: one Send per document
    return [Send("summarize_doc", {"document": doc}) for doc in state["documents"]]

def summarize_doc(state: DocumentState) -> dict:
    summary = llm.invoke(f"Summarize: {state['document']}").content
    return {"summaries": [summary]}

def synthesize(state: OverallState) -> dict:
    combined = "\n".join(state["summaries"])
    synthesis = llm.invoke(f"Synthesize these summaries: {combined}").content
    return {"final_synthesis": synthesis}

graph = StateGraph(OverallState)
graph.add_node("summarize_doc", summarize_doc)
graph.add_node("synthesize", synthesize)
graph.add_conditional_edges(START, split_documents, ["summarize_doc"])
graph.add_edge("summarize_doc", "synthesize")
graph.add_edge("synthesize", END)

compiled = graph.compile()
result = compiled.invoke({
    "documents": ["Doc 1 content...", "Doc 2 content...", "Doc 3 content..."],
    "summaries": [],
    "final_synthesis": ""
})
print(result["final_synthesis"])
```

---
---

# AgentOps

## AgentOps Overview

AgentOps is an **observability, monitoring, and analytics platform** purpose-built for AI agents. While LangGraph is a framework for building agents, AgentOps sits one layer above: it instruments whatever agent framework you use (LangChain, LangGraph, AutoGen, CrewAI, raw OpenAI SDK, etc.) and gives you a unified dashboard for tracking sessions, debugging failures, analyzing costs, and optimizing performance.

The core thesis of AgentOps is that AI agents are notoriously opaque — they make many LLM calls, invoke many tools, and fail in subtle ways that are hard to reproduce. AgentOps makes every agent session **fully observable** with minimal code changes: often just two lines of initialization code.

**Key capabilities at a glance:**
- Session-level observability with a timeline view of every event
- LLM call recording (prompt, response, token counts, latency, cost)
- Tool call recording (arguments, return values, errors)
- Agent-level grouping (which agent made which calls)
- Cost analytics across models and sessions
- Error detection and root cause analysis
- Replay debugging (replay any session step by step)
- Framework-agnostic instrumentation via auto-patching

---

## AgentOps Core Architecture

AgentOps is architecturally a **telemetry pipeline with a SaaS backend**. The data flow is:

```
Your Agent Code
    (AgentOps SDK patches LLM clients, tool calls, agent events)
In-Process Event Queue
    (batched, async HTTP)
AgentOps Ingest API (REST)
    (event storage and processing)
AgentOps Dashboard (web UI)
    (optional)
Alerts, Webhooks, Exports
```

### SDK Layer

The AgentOps Python SDK (`agentops` package) operates through two mechanisms:

**1. Monkey-patching (auto-instrumentation)**

When you call `agentops.init()`, the SDK automatically patches known LLM client libraries:
- `openai.chat.completions.create`
- `anthropic.messages.create`
- `cohere.Client.chat`
- `groq.Client.chat.completions.create`
- LangChain callback system (via a custom `AgentOpsHandler`)
- LlamaIndex callback system
- AutoGen agent events
- CrewAI task events

**2. Decorator and context manager APIs**

For custom agents and tools, you explicitly annotate your code:

```python
@agentops.record_action("search_web")
def search(query: str) -> str:
    ...

@agentops.record_tool("calculator")
def calculate(expression: str) -> float:
    ...
```

### Event Model

Everything in AgentOps is an **event**. Events are the atomic unit of observation:

| Event Type | Triggered By | Contains |
|---|---|---|
| `LLMEvent` | Any LLM API call | model, prompt, completion, tokens, cost, latency |
| `ActionEvent` | `@record_action` decorated function | action name, params, returns, errors |
| `ToolEvent` | `@record_tool` or auto-patched tool | tool name, input, output, errors |
| `ErrorEvent` | Uncaught exceptions (auto-captured) | exception type, message, stack trace, triggering event |
| `AgentEvent` | Agent lifecycle (start/end) | agent name, role, parent agent |
| `SessionEndEvent` | `agentops.end_session()` | outcome (Success/Fail/Indeterminate), rating |

Events are associated with:
- A **session** (top-level grouping)
- An **agent** (which agent produced the event, in multi-agent setups)
- A **timestamp** and **duration**
- Optional **tags** (user-defined labels for filtering)

---

## Session Tracking

The **session** is the fundamental unit of organization in AgentOps. A session represents one complete agent execution — one user request, one background job, one autonomous task run.

### Session Lifecycle

```
agentops.init(api_key)           # SDK ready; session NOT yet started
agentops.start_session(tags=[])  # Session starts; session_id assigned
    [... agent executes, events are recorded ...]
agentops.end_session(            # Session ends; final event sent
    end_state="Success",
    end_state_reason="Task completed successfully"
)
```

Or using the context manager:

```python
with agentops.start_session(tags=["production", "user-123"]) as session:
    # Everything inside is part of this session
    result = my_agent.run(task)
    session.set_tags(["task_type:research"])
```

### Session Identity

Each session has:
- A UUID `session_id`
- A `session_url` — direct link to the session in the AgentOps dashboard
- A start timestamp
- An end timestamp (set on completion)
- An `end_state` (outcome enum: Success / Fail / Indeterminate)
- Tags (list of strings for filtering/grouping)
- Metadata (optional key-value pairs)

```python
session = agentops.start_session()
print(session.session_url)
# e.g.: https://app.agentops.ai/sessions/abc-123-def-456
```

### Thread Safety and Multi-Session

AgentOps supports multiple concurrent sessions in a single process:

```python
session_a = agentops.start_session(tags=["user-alice"])
session_b = agentops.start_session(tags=["user-bob"])

with session_a:
    alice_agent.run(alice_task)

with session_b:
    bob_agent.run(bob_task)
```

Sessions are stored in thread-local storage by default, so multi-threaded applications automatically route events to the correct session.

---

## AgentOps Tasks and Projects

AgentOps does not have a native "task" primitive in its data model. Tasks are represented as **sessions** (one task = one session) or as **actions within a session** (if a session contains multiple sub-tasks).

### Projects

AgentOps uses **projects** as the top-level organizational unit in the dashboard:
- Each API key is scoped to a project
- Sessions are grouped under a project
- Cost analytics, error rates, and usage metrics are aggregated per project
- Multiple environments (dev, staging, prod) can share a project or use separate projects

### Tags as Task Organization

The primary mechanism for organizing sessions into logical task types is **tags**:

```python
agentops.start_session(tags=[
    "env:production",
    "task:customer_support",
    "user:user-123",
    "model:gpt-4o",
    "version:2.1.0"
])
```

Tags are indexed and filterable in the dashboard, enabling queries like:
- "Show all sessions tagged `task:customer_support` that failed"
- "Compare average cost between `model:gpt-4o` and `model:gpt-4o-mini` sessions"

---

## AgentOps Agent Communication and Coordination

AgentOps is an **observability tool, not a coordination framework**. It does not manage how agents communicate — it observes and records that communication.

### Multi-Agent Tracking

In a multi-agent system (e.g., a supervisor with sub-agents), AgentOps tracks each agent separately within the same session:

```python
@agentops.track_agent(name="supervisor")
class SupervisorAgent:
    def run(self, task):
        ...

@agentops.track_agent(name="researcher")
class ResearcherAgent:
    def search(self, query):
        ...
```

The `@track_agent` decorator groups all events from that agent under a named agent entry. In the dashboard, you can:
- View events grouped by agent
- See the parent-child relationship between agents
- Trace a specific LLM call back to the exact agent that made it

### Agent Event Hierarchy

For hierarchical agent systems, AgentOps captures the call tree:

```
Session
└── SupervisorAgent (AgentEvent: started)
    ├── LLMEvent: "Decide which sub-agent to call"
    ├── ResearcherAgent (AgentEvent: started by supervisor)
    │   ├── ToolEvent: "tavily_search('quantum computing')"
    │   └── LLMEvent: "Summarize search results"
    └── WriterAgent (AgentEvent: started by supervisor)
        └── LLMEvent: "Write final report"
```

This tree is visualized in the AgentOps session timeline, making it easy to see the flow of control between agents.

---

## AgentOps Agent Types and Roles

AgentOps does not define or enforce agent types — it is framework-agnostic. However, it has specific integrations and documentation for the most common multi-agent frameworks:

### Supported Frameworks (First-Class Integrations)

| Framework | Integration Method | Auto-Instrumented |
|---|---|---|
| **LangChain / LangGraph** | `AgentOpsHandler` callback | LLM calls, tool calls, chain events |
| **OpenAI Agents SDK** | Automatic patching | All API calls, tool use |
| **AutoGen** | Built-in support | Agent conversations, LLM calls |
| **CrewAI** | Automatic patching | Task execution, agent delegation |
| **LlamaIndex** | Callback handler | Query events, LLM calls |
| **Anthropic SDK** | Automatic patching | All `messages.create` calls |
| **Cohere SDK** | Automatic patching | Chat and generate calls |
| **Mistral SDK** | Automatic patching | Chat calls |
| **Groq SDK** | Automatic patching | Chat calls |
| **Raw OpenAI SDK** | Automatic patching | All completion calls |

For unsupported frameworks, you use the explicit decorator API.

### Agent Roles in AgentOps Tracking

When using `@track_agent`, you assign names freely:

```python
@agentops.track_agent(name="planner")
class PlannerAgent: ...

@agentops.track_agent(name="executor")
class ExecutorAgent: ...

@agentops.track_agent(name="critic")
class CriticAgent: ...
```

These names appear in the dashboard and can be used for filtering analytics (e.g., "which agents are most expensive?").

---

## AgentOps Task Execution and Tracking

### Event Recording in Detail

#### LLM Events

LLM events are the richest event type. AgentOps captures:

```json
{
    "event_type": "llms",
    "model": "gpt-4o-2024-11-20",
    "prompt": [
        {"role": "system", "content": "You are a helpful assistant"},
        {"role": "user", "content": "What is 2+2?"}
    ],
    "completion": {"role": "assistant", "content": "2+2 equals 4."},
    "prompt_tokens": 24,
    "completion_tokens": 10,
    "cost": 0.000170,
    "init_timestamp": "2025-01-01T10:00:00.000Z",
    "end_timestamp": "2025-01-01T10:00:01.250Z",
    "model_params": {"temperature": 0.7, "max_tokens": 1000},
    "session_id": "abc-123",
    "agent_id": "researcher-agent"
}
```

Cost is in USD, calculated automatically from the token counts against AgentOps's internal model pricing database.

#### Tool/Action Events

```json
{
    "event_type": "tools",
    "name": "web_search",
    "logs": {
        "input": {"query": "quantum computing advances 2025"},
        "output": [{"title": "...", "url": "...", "content": "..."}],
        "error": null
    },
    "init_timestamp": "2025-01-01T10:00:05.000Z",
    "end_timestamp": "2025-01-01T10:00:06.800Z",
    "session_id": "abc-123"
}
```

#### Error Events

AgentOps automatically captures uncaught exceptions and associates them with the event that caused them:

```json
{
    "event_type": "errors",
    "error_type": "RateLimitError",
    "message": "Rate limit exceeded for model gpt-4o",
    "traceback": "...",
    "trigger_event": { }
}
```

### Real-Time vs. Batch Recording

Events are buffered in memory and flushed:
- When the buffer reaches a configurable size threshold
- On a configurable time interval (default: every few seconds)
- When `end_session()` is called (flush all pending events)

This means the dashboard updates near-real-time during a running session.

### Session Outcome Tracking

```python
try:
    result = agent.run(task)
    agentops.end_session("Success", end_state_reason=f"Completed: {result[:100]}")
except Exception as e:
    agentops.end_session("Fail", end_state_reason=f"Error: {str(e)}")
```

Sessions end with one of three outcomes:
- `"Success"` — task completed as intended
- `"Fail"` — task failed (exception, incorrect result, timeout)
- `"Indeterminate"` — ambiguous result (requires human review)

These outcomes drive the error rate metrics in analytics.

---

## AgentOps Database and Storage

AgentOps is a **SaaS platform** — you do not manage the database. All event data is stored on AgentOps infrastructure.

### Data Model (Logical)

```
Project
└── Sessions
    ├── Events (LLM, Tool, Action, Error, Agent)
    ├── Tags
    └── Metadata

Analytics Aggregates
├── Cost per session / per model / per tag
├── Latency distributions
├── Error rates
├── Token usage
└── Agent performance metrics
```

### Data Retention

- Free tier: limited retention (approximately 30 days)
- Paid tiers: longer retention windows (up to 1 year depending on tier)
- Enterprise: configurable retention

### Data Export

Sessions and events can be exported via:
- REST API (`GET /v2/sessions`, `GET /v2/events`)
- CSV export from the dashboard
- Webhooks (push events to your own storage)

### Self-Hosting

AgentOps does not offer a standard self-hosted option. If data residency is a hard requirement, you must either export events via the API to your own storage, or negotiate a dedicated deployment with AgentOps.

### SDK-Side Storage

The SDK itself stores nothing persistently — it buffers events in memory before sending them to the API. If the process crashes before flushing, buffered events may be lost.

---

## AgentOps Deployment Model

### SaaS (Primary)

The standard deployment is fully managed SaaS:

1. Sign up at `app.agentops.ai`
2. Create a project, get an API key
3. `pip install agentops`
4. Add `agentops.init(api_key)` to your code
5. All events flow to AgentOps's cloud infrastructure

No infrastructure to manage on your side.

### SDK Initialization Modes

```python
import agentops

# Basic
agentops.init(api_key="your-key")

# With full configuration
agentops.init(
    api_key="your-key",
    default_tags=["production", "v2.0"],
    auto_start_session=False,       # manually control session start
    skip_auto_end_session=True,     # manually control session end
    instrument_llm_calls=True,      # auto-patch LLM clients (default True)
    endpoint="https://api.agentops.ai",
    max_wait_time=5000,             # ms to wait for API on shutdown
    max_queue_size=100,             # event buffer size
)
```

### Environment Variable Configuration

```bash
AGENTOPS_API_KEY=your-key
AGENTOPS_PARENT_KEY=your-org-key
AGENTOPS_ENDPOINT=https://api.agentops.ai
AGENTOPS_LOGGING_LEVEL=DEBUG
```

### CI/CD and Testing

AgentOps sessions can be created in CI pipelines for regression tracking:

```python
agentops.init(
    api_key=os.environ["AGENTOPS_API_KEY"],
    default_tags=["ci", f"branch:{os.environ.get('BRANCH_NAME', 'unknown')}"]
)
```

This allows tracking model performance regressions and cost changes across builds.

---

## AgentOps Unique Features

### 1. Automatic Cost Calculation

AgentOps maintains an internal database of token pricing for all major models. Every `LLMEvent` is automatically annotated with a cost estimate in USD:

```
gpt-4o:               $2.50 / 1M input tokens,  $10.00 / 1M output tokens
gpt-4o-mini:          $0.15 / 1M input tokens,  $0.60 / 1M output tokens
claude-3-5-sonnet:    $3.00 / 1M input tokens,  $15.00 / 1M output tokens
```

The dashboard aggregates costs by:
- Per session
- Per agent
- Per model
- Per tag combination
- Over time (daily/weekly/monthly trends)

This is arguably AgentOps's most practical feature: you can immediately see how much each type of agent task costs and optimize accordingly.

### 2. Replay Debugging

Any session in the dashboard can be **replayed** step by step:
- See the exact sequence of events in the order they occurred
- Expand any LLM event to see the full prompt and completion
- Expand any tool event to see the exact inputs and outputs
- See the full error context when something went wrong
- Jump to any point in the timeline

This eliminates the "logs are not enough" problem with LLM applications — you need to see the exact prompts, not just that "the agent called the LLM."

### 3. Session Comparison

You can compare two sessions side by side:
- Same task, different models (cost/quality comparison)
- Same task, before and after a prompt change
- Two runs of the same workflow that had different outcomes

### 4. Multi-Model Cost Optimization

The analytics dashboard includes insights that highlight, based on your task patterns, which steps could be run on cheaper models without significant quality loss.

### 5. Error Clustering

AgentOps clusters similar errors across sessions:
- "RateLimitError occurred in 23% of sessions this week"
- "Tool call to `database_query` fails when the query exceeds 1000 characters"

This turns scattered failures into actionable patterns.

### 6. A/B Testing Support via Tags

Tag-based analytics enable lightweight A/B testing of agent configurations:

```python
# Session A: control
agentops.start_session(tags=["experiment:prompt-v1"])

# Session B: treatment
agentops.start_session(tags=["experiment:prompt-v2"])
```

Then filter by tag in analytics to compare success rates, costs, and latency.

### 7. LangChain / LangGraph Deep Integration

When used with LangGraph, AgentOps captures each node execution as an action event, each LLM call within a node, chain starts and ends, retrieval events, and memory operations:

```python
from langchain.callbacks import AgentOpsHandler

handler = AgentOpsHandler()
result = graph.invoke(
    input,
    config={"callbacks": [handler]}
)
```

### 8. Async Support

The SDK is fully async-capable:

```python
agentops.init(api_key="your-key")

async def run_async_agent():
    async with agentops.start_session() as session:
        result = await async_agent.arun(task)
```

### 9. Custom Metric Recording

You can push custom metrics from within your agent:

```python
session = agentops.get_current_session()
session.record(agentops.ActionEvent(
    action_type="custom_quality_score",
    params={"document_id": "doc-123"},
    returns={"relevance_score": 0.87, "fluency_score": 0.92}
))
```

---

## AgentOps Limitations

1. **SaaS-only (standard)** — No official self-hosted option. All agent traces, prompts, and completions leave your infrastructure. This is a non-starter for many enterprise, legal, and regulated-industry deployments.

2. **Not a framework** — AgentOps does not help you build agents. If you need orchestration, routing, memory, or tool management, you still need LangGraph, AutoGen, CrewAI, etc. AgentOps only observes.

3. **Best-effort cost calculation** — Token prices change frequently and model IDs can be non-standard. AgentOps's cost estimates may lag behind actual pricing, especially for fine-tuned models or new releases.

4. **Python primary** — The JavaScript SDK exists but lags behind the Python SDK in feature parity and framework integrations.

5. **Prompt storage and privacy** — Storing full prompts and completions raises privacy concerns. If your agents handle sensitive data (PII, proprietary content), you must implement prompt scrubbing before events are sent; the SDK does not do this automatically.

6. **Latency overhead** — The SDK adds a small latency overhead for event buffering and async HTTP. This is typically negligible (under 5ms per event) but measurable in high-throughput scenarios.

7. **Limited real-time alerting** — While AgentOps can show failure patterns in the dashboard, real-time alerting (PagerDuty, instant Slack alerts on error spikes) is limited in standard tiers and requires additional configuration.

8. **No agent control plane** — AgentOps is observe-only. It cannot intervene in a running session, pause an agent, or inject state changes.

9. **Retention and storage costs at scale** — For very high-volume systems (millions of LLM calls per day), storing full prompt/completion pairs in AgentOps can become expensive.

10. **Framework version sensitivity** — Auto-patching relies on specific internal APIs of LLM libraries. Major version upgrades of `openai`, `anthropic`, or LangChain can temporarily break auto-instrumentation until AgentOps updates the SDK.

---

## AgentOps Code Examples

### Example 1: Basic Setup with OpenAI

```python
import agentops
from openai import OpenAI

# Initialize AgentOps — automatically patches OpenAI client
agentops.init(api_key="your-agentops-key")

client = OpenAI(api_key="your-openai-key")

# Start a session
session = agentops.start_session(tags=["demo", "gpt-4o"])
print(f"Session URL: {session.session_url}")

try:
    # This call is automatically tracked — no extra code needed
    response = client.chat.completions.create(
        model="gpt-4o",
        messages=[
            {"role": "system", "content": "You are a helpful assistant."},
            {"role": "user", "content": "Explain quantum entanglement in 3 sentences."}
        ],
        temperature=0.7
    )
    print(response.choices[0].message.content)
    agentops.end_session("Success")

except Exception as e:
    agentops.end_session("Fail", end_state_reason=str(e))
    raise
```

### Example 2: Multi-Agent Tracking

```python
import agentops
from openai import OpenAI

agentops.init(api_key="your-key")
client = OpenAI()

@agentops.track_agent(name="planner")
class PlannerAgent:
    def plan(self, goal: str) -> list[str]:
        response = client.chat.completions.create(
            model="gpt-4o",
            messages=[
                {"role": "system", "content": "Break down the goal into 3 concrete steps."},
                {"role": "user", "content": goal}
            ]
        )
        steps = response.choices[0].message.content.split("\n")
        return [s.strip() for s in steps if s.strip()]

@agentops.track_agent(name="executor")
class ExecutorAgent:
    @agentops.record_action("execute_step")
    def execute(self, step: str) -> str:
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": "Execute this step and report the outcome."},
                {"role": "user", "content": step}
            ]
        )
        return response.choices[0].message.content

with agentops.start_session(tags=["multi-agent", "planning"]) as session:
    planner = PlannerAgent()
    executor = ExecutorAgent()

    goal = "Research and summarize recent advances in renewable energy"
    steps = planner.plan(goal)

    results = []
    for step in steps:
        result = executor.execute(step)
        results.append(result)

    print("All steps completed:", results)
# Session automatically ends with "Indeterminate" if end_state not set
```

### Example 3: LangGraph + AgentOps Integration

```python
import agentops
from langchain_openai import ChatOpenAI
from langchain_core.messages import HumanMessage
from langchain.callbacks import AgentOpsHandler
from langgraph.prebuilt import create_react_agent
from langgraph.checkpoint.memory import MemorySaver
from langchain_community.tools.tavily_search import TavilySearchResults

# Initialize both systems
agentops.init(api_key="your-agentops-key")

llm = ChatOpenAI(model="gpt-4o")
tools = [TavilySearchResults(max_results=3)]
memory = MemorySaver()

agent = create_react_agent(model=llm, tools=tools, checkpointer=memory)

agentops_handler = AgentOpsHandler()

with agentops.start_session(tags=["langgraph", "research"]) as session:
    config = {
        "configurable": {"thread_id": "research-session-1"},
        "callbacks": [agentops_handler]
    }

    result = agent.invoke(
        {"messages": [HumanMessage("What are the latest developments in fusion energy?")]},
        config
    )

    print(result["messages"][-1].content)
    print(f"View full trace: {session.session_url}")
```

### Example 4: Tool Tracking with Error Handling

```python
import agentops
import requests
from openai import OpenAI

agentops.init(api_key="your-key")
client = OpenAI()

@agentops.record_tool("weather_api")
def get_weather(city: str) -> dict:
    response = requests.get(
        "https://api.openweathermap.org/data/2.5/weather",
        params={"q": city, "appid": "your-weather-key", "units": "metric"},
        timeout=5
    )
    response.raise_for_status()
    return response.json()

@agentops.record_action("analyze_weather")
def analyze_weather_data(weather_data: dict) -> str:
    prompt = f"Given this weather data: {weather_data}, what should I wear today?"
    response = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[{"role": "user", "content": prompt}]
    )
    return response.choices[0].message.content

session = agentops.start_session(tags=["weather-agent"])
try:
    weather = get_weather("London")
    recommendation = analyze_weather_data(weather)
    print(recommendation)
    agentops.end_session("Success")
except requests.RequestException as e:
    agentops.end_session("Fail", end_state_reason=f"Weather API error: {e}")
except Exception as e:
    agentops.end_session("Fail", end_state_reason=f"Unexpected error: {e}")
    raise
```

### Example 5: Cost Monitoring with Rich Tagging

```python
import agentops
import os
from openai import OpenAI

agentops.init(api_key=os.environ["AGENTOPS_API_KEY"])
client = OpenAI()

def run_agent_task(
    task: str,
    user_id: str,
    task_type: str,
    model: str = "gpt-4o"
) -> str:
    """Run a task with full AgentOps observability and rich tagging."""

    session = agentops.start_session(tags=[
        f"user:{user_id}",
        f"task_type:{task_type}",
        f"model:{model}",
        f"env:{os.environ.get('ENVIRONMENT', 'dev')}",
        f"version:{os.environ.get('APP_VERSION', '0.0.1')}",
    ])

    try:
        messages = [
            {"role": "system", "content": f"You are an expert at {task_type} tasks."},
            {"role": "user", "content": task}
        ]

        # All calls tracked with cost calculations
        response1 = client.chat.completions.create(model=model, messages=messages)
        messages.append({"role": "assistant", "content": response1.choices[0].message.content})
        messages.append({"role": "user", "content": "Please expand on your answer with specific examples."})

        response2 = client.chat.completions.create(model=model, messages=messages)
        final_answer = response2.choices[0].message.content

        agentops.end_session(
            "Success",
            end_state_reason=f"Task '{task_type}' completed for user {user_id}"
        )
        return final_answer

    except Exception as e:
        agentops.end_session("Fail", end_state_reason=str(e))
        raise

# Dashboard will show cost breakdown by task_type, user, model, and environment
answer = run_agent_task(
    task="Explain the Transformer architecture",
    user_id="user-42",
    task_type="technical_explanation",
    model="gpt-4o"
)
```

---
---

# Side-by-Side Comparison

| Dimension | LangGraph | AgentOps |
|---|---|---|
| **Primary Purpose** | Build stateful agent workflows | Observe and monitor agent workflows |
| **Layer** | Framework / execution engine | Observability / telemetry platform |
| **State Management** | Full, explicit, checkpointed | None (passthrough observer) |
| **Agent Coordination** | First-class (graph edges, commands) | Observed only (not managed) |
| **Persistence** | SQLite, PostgreSQL (checkpointer) | SaaS cloud storage |
| **Human-in-the-Loop** | Native (interrupt_before/after) | None |
| **Cost Tracking** | None native | Native, automatic, per-event |
| **Replay Debugging** | Time-travel via checkpoints | Step-by-step session replay |
| **Deployment** | Library + optional LangGraph Platform | SaaS only (no standard self-hosting) |
| **Framework Compatibility** | Best with LangChain, works standalone | Agnostic (OpenAI, Anthropic, all major LLM SDKs) |
| **Learning Curve** | Steep (graph model, reducers, channels) | Shallow (2-line setup) |
| **Production Readiness** | High (checkpointing, fault tolerance) | High (low overhead, async) |
| **Data Ownership** | Full (you own the database) | Limited (data lives in AgentOps cloud) |
| **Parallelism** | Native fan-out/fan-in | Observed, not managed |
| **Scheduling** | Via LangGraph Platform cron runs | Not applicable |
| **Typical Together Use** | Build the agent | Observe it |

**They are complementary, not competing.** The ideal production stack for complex agents often uses both: LangGraph for the agent orchestration and state management, AgentOps (or LangSmith) for observability and cost management. LangGraph tells you what the agent can do; AgentOps tells you what it actually did, how much it cost, and where it broke.

---

# AI Agent Systems — Industry Patterns & Best Practices

> Researched and documented in the context of the OpenClaw / PROJECT-CLAW platform.
> Examples are drawn from this codebase and cross-referenced against industry patterns in
> LangChain, AutoGen, CrewAI, OpenAI Assistants, AWS Bedrock Agents, and published
> academic/engineering literature.

---

## Table of Contents

1. [Agent Communication Protocols](#1-agent-communication-protocols)
2. [Task Execution Patterns](#2-task-execution-patterns)
3. [Agent Role Architectures](#3-agent-role-architectures)
4. [Database and Storage Patterns](#4-database-and-storage-patterns)
5. [Deployment Patterns](#5-deployment-patterns)

---

## 1. Agent Communication Protocols

### 1.1 Message Passing

Message passing is the foundational pattern for agent communication. Each agent is a discrete process that communicates only through explicit messages — no shared mutable state is read directly.

**Variants:**

| Variant | Description | When to Use |
|---------|-------------|-------------|
| Direct (point-to-point) | Agent A sends a message to Agent B's inbox | Task delegation, PM→worker assignment |
| Broadcast | One sender, many receivers | System alerts, inventory status changes |
| Topic-based pub/sub | Agents subscribe to named channels | Project chat, R&D feed, cost updates |
| Request-Reply | Sender waits for a response before continuing | Synchronous subtask spawning |

**OpenClaw implementation:** The `WebSocketManager.broadcast()` method encodes all three receiving modes — channel subscription, project subscription, and direct user/agent targeting — into a single function with filter objects:

```js
// From websocket.js — broadcast with routing filters
broadcast(event, data, filters = {}) {
  const { channel = null, projectId = null, userId = null } = filters;
  // ...routes to matching clients only
}
```

Task-assignment messages use dual delivery: one broadcast to all project subscribers (for admin dashboards), and one direct targeted delivery to the specific agent:

```js
// emitTaskAssigned — dual delivery pattern
this.broadcast('task:assigned', payload, { projectId });          // project-wide
this.broadcast('agent:task_assigned', payload, { userId: agentId }); // direct to agent
```

### 1.2 Shared Memory / Blackboard Systems

A **blackboard** is a central shared data store that agents read from and write to independently. No agent calls another agent directly — they communicate by mutating the blackboard, which triggers subscribed agents to react.

**Classic pattern:**
```
                  ┌─────────────────┐
   Agent A ──────►│   BLACKBOARD    │◄────── Agent C
   Agent B ──────►│  (shared state) │─────── Agent D (watcher)
                  └─────────────────┘
```

**In agent systems today, the blackboard is typically:**
- A database table (tasks, projects) — persisted blackboard
- A Redis key-value store — ephemeral, fast blackboard
- A message queue (RabbitMQ, Kafka) — ordered event blackboard

**OpenClaw implementation:** The `tasks` table acts as a blackboard. Agents do not call each other — instead:
1. An admin or PM writes a task record with `status = 'pending'` and `agent_id = NULL`
2. The orchestration engine sweeps the blackboard (`runAutoAssignmentSweep`) and assigns tasks
3. The assigned agent reads its own pending tasks via polling or WebSocket notification

```js
// orchestration-engine.js — sweep the blackboard
const unassigned = db.prepare(`
  SELECT * FROM tasks WHERE status = 'pending' AND agent_id IS NULL
  ORDER BY priority ASC, created_at ASC
`).all();
```

### 1.3 Event-Driven vs. Polling

| Pattern | Mechanism | Latency | Load | Best For |
|---------|-----------|---------|------|----------|
| **Polling** | Agent calls `GET /tasks?agent_id=X` on a timer | High (timer interval) | Wastes requests | Simple agent CLIs, fallback |
| **Long polling** | HTTP request held open until server has data | Medium | Moderate | Browsers without WS support |
| **WebSocket** | Persistent bidirectional TCP connection | Near-zero | Low overhead per message | Real-time dashboards, agent event loops |
| **Server-Sent Events (SSE)** | One-way server-to-client HTTP stream | Low | Lower than WS | Read-only live feeds (R&D feed, cost monitor) |
| **Webhook / callback** | Server POSTs to agent's own endpoint | Low | Minimal server load | External agents with their own HTTP server |

**Industry recommendation:** Use WebSocket for anything requiring sub-second reaction time. Use polling only as a fallback or for agents that cannot maintain persistent connections (serverless lambdas, CLI agents).

**OpenClaw implementation:** The `agentCLI.js` uses WebSocket as primary with a 25-second client-side ping to prevent keepalive timeouts:

```js
// agentCLI.js — client-side keepalive for WS
setInterval(() => {
  if (ws.readyState === WebSocket.OPEN) {
    // Send masked RFC 6455 ping frame (opcode 9)
    ws.ping();
  }
}, 25_000);
```

The server sends `socket.ping()` every 30 seconds from the other direction to detect dead connections.

**R&D agents** use a different pattern entirely — they do not poll at all. They run on cron schedules (`node-cron`) and produce output only when their interval fires. This is appropriate because their output has no real-time dependency.

### 1.4 WebSocket vs REST for Agent Coordination

**Use REST when:**
- The operation is a durable state change (register agent, create project, assign task)
- The client may be stateless (CLI tools, curl scripts, external integrations)
- You need full HTTP semantics (auth headers, status codes, retries)
- The operation is infrequent or one-shot

**Use WebSocket when:**
- Agents must react to events without polling
- Many clients need the same event simultaneously (broadcast pattern)
- You need bidirectional communication (agent sends heartbeat, server sends assignments)
- Latency matters (chat, live inventory updates)

**Hybrid pattern (used in OpenClaw):**
- All persistent state mutations (CRUD) go through REST
- All real-time notifications and presence signals go through WebSocket
- WebSocket connections authenticate via JWT token in the query string: `ws://host:3001/ws?token=<jwt>`

```
REST  ──► State mutations (register, assign, complete)
WS    ──► Real-time events (task:assigned, agent:approved, chat:message)
```

### 1.5 Agent-to-Agent Task Delegation Patterns

**Delegation models:**

**1. Hierarchical delegation (top-down)**
The PM agent receives a goal, decomposes it, and pushes subtasks down to worker agents. Workers do not call each other directly — all coordination flows through the PM.

```
Human → PM Agent → [Frontend Worker]
                 → [Backend Worker]
                 → [DevOps Worker]
```

**OpenClaw implementation:** `delegateTasksToWorkers()` in `pm-delegation.js` — the PM automation generates a task list, then the delegation engine scores and assigns each task to the best available worker:

```js
function delegateTasksToWorkers(projectId, tasks, pmAgentId, db, wsManager) {
  const workers = db.prepare(`SELECT ma.* FROM manager_agents ma
    JOIN agent_projects ap ON ap.agent_id = ma.id
    WHERE ap.project_id = ? AND ma.agent_type = 'worker' ...`).all(projectId, pmAgentId);

  for (const task of tasks) {
    const worker = pickWorker(task.title, workers, taskCounts, task.priority, db);
    db.prepare(`UPDATE tasks SET agent_id = ?, ...`).run(worker.id, ...);
  }
}
```

**2. Peer-to-peer delegation**
Agents negotiate directly. Used in the Internal Agent Bus pattern — a frontend agent and backend agent negotiate an API contract without PM involvement.

```
Frontend Agent ←──────────────────→ Backend Agent
               "What endpoints do you expose?"
               "Here's the schema: GET /products, POST /cart"
               "Confirmed. I'll build the client."
```

In OpenClaw, this is modeled as the **Internal Agent Bus** — a `channel` of type `internal_bus` scoped to a project. Messages are mirrored to the Project Chat for human visibility.

**3. Market / auction delegation**
Agents broadcast a task and available agents "bid" based on current capacity. The lowest-load or best-skilled agent wins the bid. This is the basis of the orchestration engine's scoring model:

```js
// orchestration-engine.js — bid scoring
let score = 0;
if (agent.status === 'online')  score += 10;  // availability bid
score -= (agent.active_task_count || 0) * 2;   // load penalty
if (skills.includes(role)) score += 5;         // skill match bid
```

### 1.6 Multi-Agent Conversation Patterns

**Round-robin:** Each agent takes a turn in a fixed sequence. Useful for code review pipelines (write → review → QA → approve).

**Group chat with moderator:** All agents post to a shared channel; a PM/moderator agent decides who responds next and surfaces decisions. This is the Project Chat model in OpenClaw.

**Nested conversations:** An outer conversation spawns sub-conversations for subtasks, then synthesizes their results. PM spawns parallel sub-agents (`task_decomposition`, `resource_planning`, `model_selection`), collects results, then proceeds.

**Agent introspection (self-directed):** Frameworks like AutoGen allow an agent to spawn a critic copy of itself to review its own output before returning it. This is the "reflection" pattern.

---

## 2. Task Execution Patterns

### 2.1 Task Queue Architectures

A task queue decouples the entity that creates work from the entity that executes it.

**Queue types:**

| Type | Implementation | Ordering | Reliability |
|------|---------------|----------|-------------|
| Simple DB queue | `tasks` table with `status` column | Priority + FIFO | Durable |
| In-memory queue | Node.js array, Redis list | FIFO | Volatile |
| Distributed queue | Redis Streams, RabbitMQ, SQS | Configurable | High |
| Priority queue | DB with `priority` column + index | Priority DESC | Durable |

**OpenClaw implementation:** The `tasks` table is a durable priority queue. The orchestration sweep processes unassigned tasks in priority order, lowest number first (1 = critical):

```sql
SELECT * FROM tasks
WHERE status = 'pending' AND agent_id IS NULL
ORDER BY priority ASC, created_at ASC
```

**Industry pattern — competing consumers:** Multiple worker agents can run simultaneously. Each tries to claim a task using an atomic DB update with an optimistic lock, ensuring only one worker wins each task:

```sql
-- Atomic claim (prevents double-assignment)
UPDATE tasks
SET agent_id = ?, status = 'running', claimed_at = ?
WHERE id = ? AND agent_id IS NULL AND status = 'pending'
```

If `rowsAffected = 0`, another worker already claimed the task. The worker moves on to the next one.

### 2.2 Task Decomposition and Subtask Patterns

Decomposition turns a high-level goal into a tree of concrete, assignable units.

**Flat decomposition:** Goal → N parallel tasks. Used for independent subtasks (write frontend, write backend, write tests — all can start simultaneously).

**Sequential decomposition:** Task B depends on Task A's output. Modeled with a `depends_on` field or a state machine where tasks only become `pending` when their dependencies are `completed`.

**Hierarchical decomposition:**
```
Epic: "Build checkout flow"
  └─ Story: "Cart API"
       ├─ Task: "POST /cart/add endpoint"
       ├─ Task: "DELETE /cart/item endpoint"
       └─ Task: "Cart schema migration"
  └─ Story: "Payment integration"
       ├─ Task: "Stripe webhook handler"
       └─ Task: "Payment failure UI"
```

**LLM-driven decomposition:** The PM agent receives a project description and uses an LLM to generate a task list. OpenClaw's PM automation does this — the PM agent's system prompt instructs it to output structured JSON with tasks that are then parsed and inserted into the DB.

```js
// ai-executor.js — PM system prompt fragment
if (type === 'pm') {
  return `You are ${agent.name}, a Project Manager AI agent...
  Your responsibilities: Break work into clear deliverables,
  identify dependencies, define acceptance criteria...`;
}
```

### 2.3 Parallel vs Sequential Task Execution

**Sequential:** Simple. Each task must complete before the next starts. Low throughput but easy to reason about. Use when Task B needs Task A's output.

**Parallel:** Multiple agents work simultaneously on independent tasks. High throughput. Use when tasks have no data dependency.

**Fork-join pattern:**
```
           ┌──► Task A (Frontend) ──┐
Goal ──────┤──► Task B (Backend)  ──┼──► Merge / Integration Task
           └──► Task C (Database) ──┘
```

The PM waits until all parallel tasks complete before triggering a final integration or review task.

**Pipeline pattern:**
```
Decompose → Plan → [Assign → Execute → Review] × N tasks → Ship
```

Each stage's output is the next stage's input. Common in CI/CD pipelines for agent-built software.

**OpenClaw's approach:** Tasks are assigned as soon as workers are available. There is no explicit dependency graph in the current schema — parallelism is opportunistic based on agent availability. Adding a `depends_on_task_id` column to the `tasks` table would enable strict dependency tracking.

### 2.4 Task Retry and Failure Handling

**Retry strategies:**

| Strategy | Description | Use When |
|----------|-------------|----------|
| Immediate retry | Retry at once, N times | Transient network errors |
| Fixed delay retry | Wait N seconds between retries | Rate-limited APIs |
| Exponential backoff | Wait 1s, 2s, 4s, 8s... | LLM API throttling |
| Dead-letter queue | After N failures, move to DLQ for human review | Non-recoverable errors |
| Reassignment | Mark agent as failed, reassign task to different agent | Agent crash/timeout |

**OpenClaw task lifecycle:**
```
pending → running → completed
                  → failed
                  → cancelled
```

The `acceptTask` / `startTask` / `completeTask` route handlers enforce state machine transitions. The `executeTaskRoute` catches errors and sets `status = 'failed'` with the error message stored in `result`.

**Production pattern — circuit breaker:** If an agent fails 3 tasks in a row, mark the agent `status = 'error'` and stop sending it new tasks. Only resume after a human resets it or after a cooling period.

**Idempotency:** Task execution endpoints should be idempotent — calling `POST /tasks/:id/execute` twice should not double-bill or produce duplicate results. Guard with: `if (task.status !== 'running') return 400`.

### 2.5 Task Priority and Scheduling

**Priority levels (OpenClaw schema):** Integer 1–5, where 1 = critical, 5 = low. The tasks table has `priority INTEGER DEFAULT 1 CHECK (priority BETWEEN 1 AND 5)` with an index.

**Priority queuing rule:** Always drain higher-priority tasks before lower-priority tasks. In SQL:

```sql
ORDER BY priority ASC, created_at ASC
-- priority 1 (critical) comes first, FIFO within same priority
```

**Scheduling patterns:**

**Cron-based scheduling (R&D agents):** Fixed schedules expressed as cron expressions. OpenClaw's `rnd-scheduler.js` uses `node-cron` and maps human-readable schedule strings to cron:

```js
const SCHEDULE_MAP = {
  'every_4h': '0 */4 * * *',
  'every_6h': '0 */6 * * *',
  'daily':    '0 9 * * *',
  'weekly':   '0 9 * * 1',
};
```

**Priority aging:** To prevent low-priority tasks from starving indefinitely, increase their effective priority the longer they wait:

```sql
-- Effective priority = base priority - (hours_waiting / 4)
-- A priority-3 task waiting 24 hours becomes effective priority 1
```

**Deadline scheduling:** Tasks with `due_date` fields get boosted priority as the deadline approaches. Common in SLA-bound systems.

---

## 3. Agent Role Architectures

### 3.1 Orchestrator / Worker Pattern

The most common pattern in production multi-agent systems.

```
┌─────────────────────────────────────────┐
│           ORCHESTRATOR AGENT            │
│  - Receives high-level goal             │
│  - Decomposes into subtasks             │
│  - Assigns to workers                   │
│  - Monitors progress                    │
│  - Synthesizes results                  │
└──────────┬─────────────┬────────────────┘
           │             │
    ┌──────▼──┐    ┌──────▼──┐
    │ Worker A│    │ Worker B│
    │(Frontend│    │(Backend)│
    └─────────┘    └─────────┘
```

**Key design decision:** Does the orchestrator know the domain (e.g., it's a software PM), or is it domain-agnostic (pure task router)?

- **Domain-aware orchestrator:** Faster, better assignments because it understands the work. Risk: brittle if domain changes.
- **Domain-agnostic orchestrator:** More flexible, but requires richer metadata on tasks and agents for good routing.

OpenClaw uses a **domain-aware PM agent** (loaded with a project-type preset like `webstore.md`) combined with a **domain-aware routing engine** (keyword scoring in `orchestration-engine.js` and `pm-delegation.js`).

### 3.2 PM / Worker / Specialist Hierarchies

**Two-tier (flat):**
```
PM ──► Workers (all generalists)
```
Simple. Good for small projects. Workers handle whatever comes.

**Three-tier (specialized):**
```
PM ──► Team Leads (per department) ──► Workers
```
Team leads coordinate within their department. PM only talks to leads. Scales well but adds coordination overhead.

**OpenClaw's model — two-tier with role specialization:**
```
PM Agent
  ├─► Frontend Worker (loaded with frontend.md preset)
  ├─► Backend Worker  (loaded with backend.md preset)
  ├─► DevOps Worker   (loaded with devops.md preset)
  └─► QA Worker       (loaded with qa.md preset)
```

Workers are generalists who load role-specific system prompts. The PM assigns roles dynamically at project assembly time, not at agent registration time. This is the "mode-based specialization" approach — every agent carries all presets and loads only what's needed.

**Specialist agents:** Some systems use permanently specialized agents — an agent that is always the "security auditor" and never does anything else. This is simpler to reason about but wastes capacity when security work is not needed.

**R&D agents as a parallel track:** OpenClaw's R&D agents run completely outside the project hierarchy. They do not receive task assignments; they self-schedule and produce outputs that feed back into the system's presets. This is the **autonomous background intelligence** pattern.

### 3.3 How Leading Frameworks Define Agent Roles

**LangChain / LangGraph:**
- Nodes in a directed graph = agents or tool calls
- Edges define control flow (conditional, always-on)
- Roles are implicit in node function — no formal "PM" vs "worker" distinction
- Supervisor pattern available: a supervisor node routes messages to specialized subgraphs

**AutoGen (Microsoft):**
- `AssistantAgent` — LLM-backed, responds to messages
- `UserProxyAgent` — represents the human, can execute code, trigger tool calls
- `GroupChat` — multiple agents in a round-robin or custom speaker-selection conversation
- No explicit PM concept — conversation flow emerges from speaker selection logic

**CrewAI:**
- Explicit `Agent` with `role`, `goal`, `backstory` fields
- `Crew` groups agents into a team
- `Task` objects assigned to specific agents
- Sequential or hierarchical `Process` — hierarchical adds a manager agent that routes tasks
- Closest framework equivalent to OpenClaw's PM/worker model

**OpenAI Assistants API:**
- Each assistant has a system prompt (its "role")
- `Thread` = conversation context
- `Run` = a single execution pass (like a task)
- No native multi-agent; custom orchestration needed to chain assistants

**AWS Bedrock Agents:**
- Single agent with `Action Groups` (tool calls)
- Multi-agent via `Agent Collaboration` — one agent invokes another as a tool
- Orchestration trace provides full reasoning chain visibility

### 3.4 ReAct, Chain-of-Thought, and Reasoning Patterns

**Chain-of-Thought (CoT):**
The agent is prompted to think step-by-step before producing a final answer. Improves accuracy on complex reasoning tasks. Implementation: include "Let's think step by step" in the system prompt, or use few-shot examples.

```
User: "What tasks should we create for a checkout feature?"
Agent (CoT): "First, the checkout needs a cart state... that requires a Cart API.
              Next, payment processing... Stripe integration task.
              Finally, confirmation emails... notification service task.
              Result: [Cart API, Stripe integration, Email notifications]"
```

**ReAct (Reason + Act):**
The agent alternates between reasoning steps and tool-use actions. The loop is:
1. **Thought:** "I need to check if the user exists first"
2. **Action:** `database.query("SELECT * FROM users WHERE id = ?")`
3. **Observation:** `{ id: "123", name: "Alice" }`
4. **Thought:** "User exists, now I can assign the task"
5. **Action:** `tasks.assign(...)`
6. **Observation:** `{ success: true }`
7. **Final Answer:** "Task assigned to Alice."

This is the dominant pattern in tool-using agents (LangChain Agents, OpenAI function calling, Bedrock).

**Reflection:**
After producing output, the agent critiques its own work. Implementation: second LLM call with the prompt "Review this output for errors or gaps." Used in OpenClaw's R&D agents implicitly — the structured output format forces the model to categorize impact level and recommend actions.

**Plan-and-Execute:**
Separate planning and execution phases. A planner LLM generates a full task list upfront. An executor LLM carries out each step, possibly re-planning if a step fails.

```
Planner: [task1, task2, task3, task4]
Executor: run task1 → OK
          run task2 → FAIL (dependency missing)
Replanner: [task2a (fix dependency), task2, task3, task4]
Executor: run task2a → OK, run task2 → OK...
```

OpenClaw's PM automation follows this model: PM LLM generates the plan (task list), then the delegation engine executes assignments.

---

## 4. Database and Storage Patterns for Agent Systems

### 4.1 Agent State Persistence

Agent state falls into three categories:

**Identity state** (permanent): who the agent is — `id`, `name`, `type`, `skills`, `experience_level`. Written once at registration, rarely updated.

**Operational state** (dynamic): what the agent is doing right now — `status`, `current_mode`, `current_model`, `current_project`. Updated frequently, must be fast to query.

**Historical state** (append-only): what the agent has done — `activity_history`, `task_assignment_history`, `cost_records`. Write-only during operation, queried for analytics and audits.

**OpenClaw schema separation:**

```sql
-- Identity + operational state (updated in-place)
manager_agents (
  id, name, handle, agent_type, role, skills,
  status, current_mode, current_model,
  is_approved, last_heartbeat, rnd_division, rnd_schedule, rnd_last_run
)

-- Historical audit trail (append-only)
activity_history (
  id, event_type, action, entity_id, entity_title,
  project_id, project_name, agent_id, agent_name,
  metadata JSON, created_at
)

-- Per-execution cost records (append-only)
cost_records (
  id, agent_id, task_id, model,
  prompt_tokens, completion_tokens, cost_usd, created_at
)
```

### 4.2 Memory Architectures

Agent memory is modeled after human cognitive architecture:

**Short-term memory (working memory):**
- The current conversation context / thread
- Active task payload and execution state
- Typically stored in the LLM's context window
- In-process: a `messages[]` array passed to each LLM call

```js
// ai-executor.js — short-term memory in the messages array
const messages = [
  { role: 'system',  content: systemPrompt },   // agent identity
  { role: 'user',    content: userMessage   },   // current task
];
```

**Long-term memory (episodic):**
- Past task results, past project outcomes
- Stored in a database, retrieved via search
- Enables agents to remember "the last time we built a checkout, we used Stripe"
- Implementation: store task results; inject relevant past results into the system prompt via similarity search

**Long-term memory (semantic/factual):**
- General knowledge about tools, libraries, best practices
- In OpenClaw, this is the **preset system** — `.md` files containing codified knowledge
- The preset content is injected into the system prompt at task execution time:

```js
// ai-executor.js — injecting preset knowledge into context
const presetBlock = getPresetContent('worker_dept', dept,
  ['Role Definition', 'Tools & Technologies', 'Standards & Best Practices']);
// Appended to system prompt, capped at MAX_PRESET_CHARS = 2000
```

**Episodic memory retrieval pattern:**
1. Agent completes a task — result stored with metadata (project type, task type, outcome)
2. Next time a similar task is assigned, a RAG (retrieval-augmented generation) step fetches relevant past results
3. These are injected into context: "Similar task in Project X used approach Y, which succeeded"

### 4.3 Vector Stores for Agent Memory

Vector stores enable semantic similarity search over agent memories — finding relevant past experiences not by exact keyword match but by meaning.

**Architecture:**
```
Task result text → Embedding model → Float vector [0.23, -0.71, ...]
                                            │
                                    Store in vector DB
                                    (Pinecone, Weaviate, pgvector, Chroma)

New task arrives → Embed task description
                 → Query: "find top-5 similar past tasks"
                 → Inject retrieved results into LLM context
```

**When to use vector stores:**
- Large knowledge bases (hundreds of past project results, documentation)
- Agents that need to learn from experience across many projects
- When keyword search is insufficient (semantically similar but different wording)

**Simpler alternatives:**
- For smaller knowledge bases: full-text search (SQLite FTS5, PostgreSQL `tsvector`)
- For structured lookups: traditional SQL joins (find past tasks with same `project_type` and `department`)

**OpenClaw's current approach:** Presets are static `.md` files injected wholesale (up to 2000 chars). A vector store upgrade would allow: embedding all preset sections, all past task results, all R&D findings — then at task execution time, retrieve only the most relevant context rather than always injecting the same preset.

### 4.4 Task and Project Data Modeling Patterns

**The task record as a work contract:**
```
Task {
  id                  -- identity
  project_id          -- scope
  agent_id            -- assignment (null = unassigned)
  title, description  -- the work specification
  status              -- state machine
  priority            -- scheduling hint
  payload JSON        -- input parameters, provider preferences
  result TEXT         -- output (LLM response)
  started_at          -- SLA tracking
  completed_at        -- SLA tracking
  assigned_by         -- audit trail
  assigned_at         -- audit trail
}
```

**State machine enforcement:** Status transitions should be enforced at the database or service layer, never trusted from client input:

```
pending → running   (agent starts the task)
running → completed (execution succeeds)
running → failed    (execution fails)
pending → cancelled (admin cancels)
```

**Important:** OpenClaw's `startTask` route enforces `status === 'pending'` before transitioning to `running`. This prevents race conditions when multiple agents try to claim the same task.

**Agent-project junction table:**
```sql
agent_projects (
  id, agent_id, project_id,
  role,        -- agent's role on this project
  status,      -- active | removed
  assigned_by, -- who added them
  assigned_at
)
```

This many-to-many design allows one agent to be on multiple projects simultaneously, and one project to have many agents. The `status` column allows soft-removal (historical record preserved).

**Cost tracking pattern:** Every LLM API call generates a `cost_records` row. Aggregating these gives per-project, per-agent, per-model spend:

```sql
-- Project spend
SELECT SUM(cost_usd) FROM cost_records
WHERE task_id IN (SELECT id FROM tasks WHERE project_id = ?)

-- Agent hourly cost rate
SELECT agent_id, SUM(cost_usd) / (JULIANDAY(MAX(created_at)) - JULIANDAY(MIN(created_at))) * 24
FROM cost_records GROUP BY agent_id
```

**Versioned presets:**
```
Preset {
  id, type, name,
  content TEXT,   -- markdown file content
  version INT,    -- monotonically increasing
  last_updated_by,
  updated_at,
  status          -- active | pending_review | archived
}
```

R&D agents write `pending_review` versions. Humans approve them, which flips `status = 'active'` and increments `version`. The old version is retained for rollback.

---

## 5. Deployment Patterns

### 5.1 Agent Fleet Deployment Models

**Process-per-agent (simple):**
Each agent is a Node.js process (`agentCLI.js`). Deployed on a machine, it registers itself via REST and maintains a WebSocket connection. This is the current OpenClaw model.

```
Machine A:  [Worker-01 process] [Worker-02 process]
Machine B:  [PM-01 process]
Machine C:  [RND-AI process]
```

**Container-per-agent:**
Each agent runs in a Docker container. Benefits: isolation, reproducible environment, easy health checks.

```yaml
# docker-compose.yml pattern
services:
  worker-01:
    image: openclaw-agent:latest
    environment:
      - AGENT_NAME=Worker-01
      - AGENT_TYPE=worker
      - API_URL=http://api-server:3001
    restart: unless-stopped
    command: node agentCLI.js --name "Worker-01" --handle worker01
```

**Serverless agent:**
Each task invocation spawns a fresh Lambda/Cloud Run instance. The agent reads its assignment, executes, writes the result, and terminates. No persistent WebSocket — task polling is replaced by direct invocation via a queue trigger (SQS → Lambda).

Tradeoffs: elastic, zero idle cost, but cold starts add latency and no persistent memory between invocations.

**Process manager (PM2/Supervisor):**
OpenClaw includes an `ecosystem.config.js` for PM2, which handles process restart on crash, log aggregation, and multi-core clustering:

```js
// ecosystem.config.js pattern
module.exports = {
  apps: [{
    name: 'api-server',
    script: 'src/server.js',
    watch: false,
    max_restarts: 10,
    restart_delay: 5000,
    env: { NODE_ENV: 'production', PORT: 3001 }
  }]
};
```

### 5.2 Machine and Node Management

The `machines` table + `machine_agents` junction table in OpenClaw tracks which physical/virtual machines host which agents. This enables:

- Fleet overview: which nodes are online
- Capacity planning: how many agents per machine
- Failure isolation: if Machine A goes offline, which agents were lost

**Machine record:**
```sql
machines (id, hostname, ip_address, os, metadata JSON, created_at)
machine_agents (id, machine_id, agent_id, registered_at)
```

**Production addition: resource metrics.** Extend the `machines` table with `cpu_percent`, `memory_mb_free`, `disk_gb_free` — updated by a lightweight agent heartbeat. The orchestrator uses this to avoid scheduling work on overloaded nodes.

### 5.3 Agent Heartbeat and Health Monitoring

**Heartbeat pattern:**
Each agent sends a periodic signal to the server confirming it is alive. The server tracks `last_heartbeat` and marks agents `offline` if the heartbeat lapses.

**OpenClaw heartbeat spec:**
- Agent sends `POST /api/agents/:id/checkin` every 30 seconds
- Server updates `last_heartbeat = datetime('now')`
- If `last_heartbeat < now - 90s`, agent is marked `offline`
- If `offline` for 5 minutes, System Alert is emitted

**Heartbeat state machine:**
```
online  ──(no heartbeat 90s)──► offline
offline ──(heartbeat received)──► online
error   ──(admin reset)──────────► online
```

**Health check cascade:**
```
Agent healthcheck (30s)
  └─► API healthcheck (Docker: GET /health every 30s)
        └─► Database healthcheck (Prisma ping every 60s)
              └─► Redis healthcheck (ping every 60s)
```

OpenClaw's API server exposes `GET /health` used by Docker Compose health checks:
```yaml
healthcheck:
  test: ["CMD", "curl", "-f", "http://localhost:3001/health"]
  interval: 30s
  timeout: 10s
  retries: 3
```

### 5.4 Auto-Scaling Agent Pools

**Reactive scaling:**
Monitor the task queue depth. When pending-unassigned tasks exceed a threshold, spawn new agent containers:

```
Queue depth > 10 unassigned tasks → spawn 2 new workers
Queue depth < 2 unassigned tasks  → terminate idle workers (scale down)
```

**Scaling trigger sources:**
- Queue depth (most common)
- Active agent CPU/memory utilization
- Time-of-day (pre-warm before expected peak)
- External event (new project created → auto-provision a PM + 3 workers)

**Pool management in OpenClaw:**
The `autoCollectWorkersForPm()` function in `pm-delegation.js` implements a soft form of auto-scaling — when a PM is assigned to a project, it automatically adds up to 3 available workers from the free pool:

```js
function autoCollectWorkersForPm(db, projectId, pmAgentId, wsManager) {
  const workers = db.prepare(`
    SELECT ma.* FROM manager_agents ma
    WHERE ma.agent_type = 'worker' AND ma.is_approved = 1
      AND ma.id NOT IN (SELECT agent_id FROM agent_projects WHERE project_id = ?)
    ORDER BY CASE ma.status WHEN 'online' THEN 0 WHEN 'idle' THEN 1 ... END ASC
    LIMIT 3
  `).all(projectId);
  // assigns them to the project
}
```

**Kubernetes-native scaling:**
For large deployments, use a Kubernetes `HorizontalPodAutoscaler` targeting a custom metric (queue depth from a Prometheus exporter):

```yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: openclaw-worker-hpa
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: openclaw-worker
  minReplicas: 2
  maxReplicas: 20
  metrics:
  - type: External
    external:
      metric:
        name: openclaw_unassigned_tasks
      target:
        type: AverageValue
        averageValue: "5"  # scale up when avg unassigned tasks > 5 per replica
```

### 5.5 Recovery Patterns

**Crash recovery:**
When an agent process crashes mid-task, the task remains in `status = 'running'` with a `started_at` but no `completed_at`. A recovery sweep job runs every few minutes:

```sql
-- Find stuck tasks (running for more than 10 minutes with no heartbeat from agent)
SELECT t.* FROM tasks t
JOIN manager_agents ma ON ma.id = t.agent_id
WHERE t.status = 'running'
  AND t.started_at < datetime('now', '-10 minutes')
  AND ma.last_heartbeat < datetime('now', '-90 seconds')
```

Recovery action: reset `status = 'pending'`, `agent_id = NULL` — the task re-enters the queue.

**Split-brain prevention:**
If two orchestrator instances run concurrently (e.g., after a failed deployment), they could both try to assign the same task. Prevent with:

1. **Optimistic locking:** UPDATE with `WHERE agent_id IS NULL` — only one instance wins
2. **Distributed lock:** Redis `SET NX EX` (set if not exists, with expiry) before sweeping
3. **Single-writer pattern:** Only one orchestration engine process writes assignments (OpenClaw uses `_sweepRunning` flag for in-process guard)

```js
// orchestration-engine.js — in-process concurrency guard
let _sweepRunning = false;

function runAutoAssignmentSweep() {
  if (_sweepRunning) {
    return { skipped_reason: 'sweep_already_running' };
  }
  _sweepRunning = true;
  try { return _doSweep(); }
  finally { _sweepRunning = false; }
}
```

**Graceful shutdown:**
Before a process terminates, it should:
1. Stop accepting new tasks
2. Complete or checkpoint current tasks
3. Send `POST /api/agents/:id/offline` to update status in DB
4. Close WebSocket connection cleanly

This prevents the server from waiting for a heartbeat timeout to discover the agent is gone.

---

## Summary Reference Table

| Pattern | OpenClaw Implementation | Industry Alternative |
|---------|------------------------|---------------------|
| Agent communication | WebSocket (events) + REST (mutations) | gRPC streams, NATS |
| Message routing | `WebSocketManager.broadcast()` with filters | Redis pub/sub, Kafka topics |
| Task queue | `tasks` table, priority + FIFO | RabbitMQ, SQS, Celery |
| Orchestration | `runAutoAssignmentSweep()` + keyword scoring | LangGraph supervisor, CrewAI manager |
| Agent memory | Preset `.md` files injected into context | RAG over vector store (pgvector, Pinecone) |
| Agent roles | Mode-based (load any preset at runtime) | Fixed-role agents (CrewAI), graph nodes (LangGraph) |
| Scheduling | `node-cron` per R&D agent | Celery Beat, Temporal workflows |
| Health monitoring | 30s heartbeat + `last_heartbeat` check | Prometheus + alertmanager |
| Scaling | Manual pool + `autoCollectWorkersForPm` | Kubernetes HPA, ECS auto-scaling |
| Cost tracking | `cost_records` table, per-task granularity | OpenRouter dashboard, LangSmith |
| Agent state | `manager_agents.status` column + WebSocket presence | Redis hash per agent, event sourcing |
| Failure recovery | Stuck-task sweep + re-queue | Dead-letter queues, saga pattern |
---

# Langfuse, OpenAgents, AgentBench, SuperAGI

---

## Langfuse — Open-Source LLM Observability

**What it is**: Langfuse is an open-source LLM engineering platform focused on tracing, evaluation, and prompt management. Think of it as Datadog/Sentry specifically for LLM pipelines.

**Core Features**:
- **Tracing**: Full trace trees showing every LLM call, tool use, chain step — with latency, token counts, cost
- **Evaluations**: Human-in-the-loop scoring, LLM-as-judge auto-evals, custom eval pipelines
- **Prompt Management**: Version-controlled prompts stored server-side, fetched at runtime (no deploy needed to update prompts)
- **Datasets**: Build eval datasets from production traces, run regression tests
- **User tracking**: Associate traces with user IDs, track per-user cost/latency

**Architecture**:
```
Your Agent Code → Langfuse SDK (Python/JS) → Langfuse Server → ClickHouse + PostgreSQL
```
- Self-hostable via Docker (popular choice for privacy-sensitive teams)
- Cloud hosted at cloud.langfuse.com (free tier: 50k observations/month)
- SDK wraps LLM calls with minimal code change: `@observe` decorator (Python) or `langfuse.trace()` (JS)

**Key Concepts**:
| Concept | Description |
|---------|-------------|
| Trace | One complete agent run (root level) |
| Span | A sub-step within a trace (tool call, retrieval, LLM call) |
| Generation | An LLM API call (tracked with model, tokens, cost) |
| Score | Human or automated quality rating on a trace |
| Session | Group of traces belonging to one conversation/session |

**Integration with OpenClaw**:
Langfuse would integrate at `ai-executor.js` level — wrap each `executeTask()` call as a trace, each LLM API call as a generation. Cost data already tracked in `cost_records` table could be cross-referenced with Langfuse's cost estimates.

```js
// Conceptual integration in ai-executor.js
const trace = langfuse.trace({ name: 'task-execute', userId: agent.id });
const generation = trace.generation({
    name: 'ollama-completion',
    model: ollamaModel,
    input: messages,
});
const result = await ollama.chat(...);
generation.end({ output: result, usage: { input: tokens.prompt, output: tokens.completion } });
```

**Comparison to alternatives**:
| Tool | Open Source | Self-host | Tracing | Evals | Prompt Mgmt |
|------|------------|-----------|---------|-------|-------------|
| Langfuse | ✓ | ✓ | ✓ | ✓ | ✓ |
| LangSmith | ✗ | ✗ | ✓ | ✓ | ✓ |
| Helicone | ✗ | Partial | ✓ | ✗ | ✗ |
| Weights & Biases | ✗ | ✗ | ✓ | ✓ | ✗ |
| Custom logging | ✓ | ✓ | Manual | Manual | Manual |

**Why teams choose Langfuse over LangSmith**:
1. MIT license, full data ownership
2. Self-host on existing infrastructure (same VPS as your api-server)
3. Works with any LLM framework (not LangChain-dependent)
4. PostgreSQL + ClickHouse backend — queryable with standard SQL

---

## SuperAGI — Open-Source Autonomous Agent Framework

**What it is**: SuperAGI is a developer-first open-source framework for building, managing, and running autonomous AI agents. Positioned as the "open-source AutoGPT" with better developer tooling.

**Core Architecture**:
```
SuperAGI Server (FastAPI + Celery)
├── Agent Runner — executes agents in Docker containers
├── Tool Registry — 50+ built-in tools (web browse, code exec, file I/O, APIs)
├── Vector Memory — Pinecone/Weaviate/Redis for agent memory
├── Workflow Engine — multi-agent workflows with dependencies
└── SuperAGI Dashboard — GUI for creating/monitoring agents
```

**Key Features**:
- **Docker-based agent isolation**: Each agent run spins up in its own container
- **Tool marketplace**: Pre-built tools for GitHub, Twitter, Google Calendar, Jira, Slack, etc.
- **Agent templates**: Reusable agent configurations with goals + tools preset
- **Performance telemetry**: Token counts, run duration, tool call success rates
- **Multiple LLM backends**: GPT-4, Claude, Llama 2, open models via local inference

**Workflow model** (vs OpenClaw):
```
SuperAGI:
  AgentTemplate → AgentRun → Task(tool calls in loop) → Complete

OpenClaw:
  Task(DB row) → Agent(WebSocket) → executeTask(LLM) → Complete
```
SuperAGI is more like a self-contained loop (agent decides its own next steps), OpenClaw is more like a task queue with human-assigned work items.

**Strengths**:
- Rich tool ecosystem out of the box
- GUI-first (non-developers can create agents)
- Container isolation prevents runaway agents from affecting host

**Weaknesses**:
- Heavy infrastructure (Redis + PostgreSQL + Celery + Docker required)
- Agent runs are relatively expensive (container startup overhead)
- Less suitable for real-time collaborative multi-agent systems

**SuperAGI vs OpenClaw comparison**:
| Aspect | SuperAGI | OpenClaw |
|--------|---------|---------|
| Task assignment | Agent self-assigns (autonomous loop) | Human assigns via HQ UI |
| Agent communication | Tool-based (write to shared memory) | WebSocket real-time events |
| Approval workflow | None — agent runs immediately | Human approval required |
| Fleet management | Kubernetes/Docker Swarm scaling | Manual fleet, machine table |
| Observability | Built-in telemetry dashboard | Manual cost_records table |
| LLM routing | Per-agent model config | Per-agent ollama_host + model |

---

## OpenAgents — Research Platform for Deployable LLM Agents

**What it is**: OpenAgents (XLang Lab, 2023) is a research-grade open platform for deploying language agents in the wild. Unlike pure frameworks, OpenAgents ships three fully functional agent applications:

1. **Data Agent** — Code interpreter for data analysis (like ChatGPT's Advanced Data Analysis)
2. **Plugins Agent** — 200+ web API plugins (like ChatGPT Plugins)
3. **Web Agent** — Autonomous web browsing agent

**Architecture**:
```
OpenAgents Platform
├── Backend: Python FastAPI
├── Frontend: React chat interface
├── Agent Backends:
│   ├── DataAgent: Code execution sandbox (Python kernel)
│   ├── PluginsAgent: OpenAPI spec parser + function calling
│   └── WebAgent: Playwright/Selenium controller
└── Model Layer: GPT-4 / Claude / open models
```

**Key Research Contributions**:
- Demonstrated that LLM agents can be deployed for real end-users (not just demos)
- Showed the gap between research benchmarks and real-world deployment challenges
- Identified three main deployment challenges: **latency**, **safety**, **cost control**

**Interaction patterns**:
```
User Message
  → Intent Classification (which agent handles this?)
  → Agent Selection (DataAgent / PluginsAgent / WebAgent)
  → Tool Planning (LLM generates tool call sequence)
  → Tool Execution (code run / API call / browser action)
  → Result Synthesis (LLM formats final answer)
  → User Response
```

**Relevance to OpenClaw**: OpenAgents' plugin architecture is analogous to OpenClaw's tool system. The intent → agent routing problem OpenAgents solves is similar to OpenClaw's `autoCollectWorkersForPm` keyword-based assignment, but more sophisticated (LLM-based routing vs keyword matching).

---

## AgentBench — Standardized LLM Agent Evaluation

**What it is**: AgentBench (THUDM, 2023) is a benchmark suite for evaluating LLM-as-agent performance across diverse real-world environments. It's the standard way to measure how well a model performs as an autonomous agent.

**8 Environments**:
| Environment | Task Type | Difficulty |
|-------------|-----------|------------|
| OS | Shell command sequences | High |
| DB | SQL database manipulation | High |
| KG | Knowledge graph traversal | Medium |
| WebShop | E-commerce purchasing | Medium |
| House | 3D household navigation | High |
| Mind2Web | Real web browsing | Very High |
| Card Games | Strategy games | Medium |
| Lateral Thinking | Creative puzzles | Medium |

**Key Findings (GPT-4 vs Open Models, 2023)**:
- GPT-4 scored 4.35 overall (best performer)
- Open-source models (LLaMA-2, Vicuna) scored 0.5–1.2 — massive gap
- Main failure modes: infinite loops, invalid actions, ignoring context
- By 2024: Llama-3.1-70B closed gap significantly (~3.1 score)

**Why this matters for your stack**:
AgentBench scores directly predict whether `huihui_ai/qwen3.5-abliterated:9b-Claude` (your Mac Mini model) will reliably complete complex tasks. Models below ~2.0 on AgentBench tend to:
- Forget their original goal mid-task
- Produce malformed JSON/tool calls
- Loop without making progress

**Practical implication**: For production tasks, consider using Claude (via OpenRouter) for PM/R&D agents and reserving local Ollama for simpler worker tasks. This is actually what OpenClaw supports — mixing providers per agent.

---

# Mac Mini Fleet Companies & Cost Analysis

---

## Companies Running Large Mac Mini / Apple Silicon Fleets

### 1. Buildkite — CI/CD on Apple Silicon at Scale

**Profile**: CI/CD platform offering macOS build agents-as-a-service.

**Fleet scale**: Thousands of Mac Mini M-series units across multiple data centers (US, EU, Asia).

**Infrastructure model**:
- Mac Minis in custom rack mounts (fits ~3 Mac Minis per standard 1U with custom brackets, or purpose-built Mac Mini racks)
- Each Mac Mini runs 1–4 CI agent processes (depending on job type)
- Managed via Buildkite Agent protocol — agents poll for jobs, execute, report results
- Fleet managed with Puppet/Ansible for configuration management

**Why Mac Mini over Linux servers**:
- iOS/macOS app builds legally require macOS — no way around it
- Mac Mini M2 Pro outperforms comparable EC2 Mac instances at fraction of the cost
- Apple Silicon power efficiency: ~20W idle vs 150W+ for x86 equivalent

**Operational learnings shared publicly**:
- Mac Minis overheat in dense rack configurations without proper airflow — need 2U spacing
- NVMe storage wears faster than expected under heavy CI I/O — SSD replacement cycle ~18 months
- USB-C Ethernet recommended over WiFi for reliability in fleet environments
- Automated re-imaging via Apple Remote Desktop + NetBoot reduces provisioning from 45min to 8min

---

### 2. MacStadium — Dedicated Mac Infrastructure Provider

**Profile**: Purpose-built cloud data center for macOS compute. Not an end-user of Mac Minis — they ARE the infrastructure layer.

**Fleet scale**: 10,000+ Mac devices (Mac Mini, Mac Pro, Mac Studio) across Atlanta, Las Vegas, Dublin, Amsterdam data centers.

**Key product**: **Orka (Orchestration with Kubernetes for Apple)** — Kubernetes-based orchestration layer for macOS VMs running on Apple Silicon bare metal.

**Architecture**:
```
Physical Mac Mini M2 Pro (host)
└── Orka Hypervisor (Apple Virtualization Framework)
    ├── VM 1 (macOS 13, 4 CPU, 8GB RAM)
    ├── VM 2 (macOS 14, 6 CPU, 12GB RAM)
    └── VM 3 (macOS 13, 2 CPU, 4GB RAM)
```

**Pricing model**:
| Instance | vCPU | RAM | Price |
|----------|------|-----|-------|
| Mac Mini M2 bare metal | 8P+4E | 24GB | ~$249/month |
| Mac Mini M2 Pro bare metal | 10P+4E | 32GB | ~$399/month |
| Orka VM (4 vCPU, 8GB) | 4 | 8GB | ~$1.30/hour |

**Business model insight**: MacStadium proves the Mac Mini fleet model at industrial scale. Their key challenge: Apple limits the software licensing to 1 macOS VM per physical CPU — you can't oversubscribe CPU like Linux VMs.

---

### 3. GitHub Actions — macOS Runners

**Profile**: GitHub's hosted macOS CI runners, all running on Apple Silicon hardware.

**Fleet scale**: Estimated 5,000–15,000 Mac machines (Apple M1/M2/M3 Mac Minis and Mac Pros).

**Pricing** (public rate card):
| Runner | RAM | Storage | Price |
|--------|-----|---------|-------|
| macos-13 (Intel) | 14GB | 14GB SSD | $0.08/min |
| macos-14 (M1) | 7GB | 14GB SSD | $0.16/min ($9.60/hr) |
| macos-15 (M1) | 7GB | 14GB SSD | $0.16/min |
| macos-14-xlarge (M1 Pro) | 30GB | 200GB | $0.32/min |

**For comparison**: An EC2 `m7g.xlarge` (Graviton, 4 vCPU, 16GB) costs ~$0.16/hr. GitHub charges $9.60/hr for macOS. **60× markup** — showing how scarce and valuable Mac compute is.

**Why GitHub uses Mac Minis over Mac Pros**:
- Mac Mini: $599–$1,999 retail, dense rackmount possible
- Mac Pro: $6,999+, overkill for most CI jobs
- Mac Studio: $1,999–$3,999, sweet spot for heavy ML/compile workloads

---

### 4. AI/ML Inference Companies — Apple Silicon as GPU Alternative

**Emerging pattern (2024–2025)**: Startups running local LLM inference on Mac Mini M3 Pro/Max clusters.

**Why Apple Silicon for AI inference**:
- M2/M3 Ultra has up to 192GB unified memory (GPU-accessible) — runs 70B+ parameter models that won't fit on any single Nvidia GPU except H100/H200
- Power efficiency: ~60 TFLOPS FP16 at 30W (M3 Max) vs 312 TFLOPS at 700W (A100)
- No driver hell: Metal works out of the box with llama.cpp/Ollama
- Cost: Mac Studio M3 Ultra ($4,999) vs H100 SXM ($35,000+)

**Representative setup (startup, ~$50K budget)**:
```
Mac Studio M3 Ultra ×4 (192GB each)  = $20,000  → run 4× 70B models simultaneously
Mac Mini M3 Pro ×10 (36GB each)      = $15,000  → run 10× 13B models simultaneously
10GbE switch + cables                 =  $2,000
NAS storage (100TB)                   =  $8,000
Rack, UPS, cabling                    =  $5,000
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Total                                 = $50,000
```

**Comparable cloud cost for same inference capacity**:
- 4× H100 instances (8× H100): ~$32/hour = $23,000/month = $276,000/year
- ROI on Mac cluster: Break-even at ~2.2 months vs cloud GPU

---

## Cost Analysis: Local Mac Mini Fleet vs Cloud

### Scenario: 10-Agent Fleet (like your OpenClaw Mac Mini setup scaled up)

**Local Mac Mini Setup**:
| Item | Qty | Unit Cost | Total |
|------|-----|-----------|-------|
| Mac Mini M3 Pro (36GB) | 5 | $1,999 | $9,995 |
| 10GbE switch | 1 | $300 | $300 |
| UPS (1500VA) | 1 | $200 | $200 |
| Power (250W avg × 5 machines) | 1 yr | $0.12/kWh | $131/yr |
| Internet (existing) | - | - | $0 |
| **Total Year 1** | | | **~$10,626** |
| **Total Year 2+** | | | **~$131/yr** |

**Cloud Equivalent (AWS EC2 Mac)**:
| Instance | vCPU | RAM | Price/hr | Monthly |
|----------|------|-----|----------|---------|
| mac2.metal (M1) | 8 | 16GB | $0.65 | $468 |
| mac2-m2.metal (M2) | 8 | 24GB | $0.65 | $468 |
| mac2-m2pro.metal (M2 Pro) | 12 | 32GB | $0.83 | $598 |

5× mac2-m2pro instances: **$2,990/month = $35,880/year**

**Break-even analysis**:
- Local hardware pays back in **~3.5 months** vs cloud Mac instances
- At 3 years: Local = $10,626 + $393 power = **$11,019 total** vs Cloud = **$107,640**
- **10× cost advantage** for sustained 24/7 workloads

### When Cloud Wins Over Local

| Factor | Favors Local | Favors Cloud |
|--------|-------------|--------------|
| Utilization | >40% average | <20% average (burst only) |
| Team location | Co-located, single office | Distributed globally |
| Maintenance | Have IT staff | No IT staff |
| Scaling speed | Weeks (order, ship, setup) | Minutes |
| Data sensitivity | High (stays on-prem) | Low |
| Upfront capital | Available | Constrained |

### The 1,000 Mac Mini Company

**Rumored examples**: Several AI companies (names undisclosed) have been reported to run 500–1,000 Mac Minis for LLM inference inference. Key characteristics:

**Infrastructure**:
```
1,000 Mac Mini M3 Pro (36GB) cluster:
├── Total compute: ~10,000 CPU cores
├── Total RAM: 36TB (all GPU-accessible for inference)
├── Network: Multiple 10GbE switches in fat-tree topology
├── Power: ~250kW load (250W avg × 1,000 machines)
├── Cooling: 2× 10-ton CRAC units minimum
└── Physical space: ~20 standard server racks (50 Mac Minis/rack)
```

**Capital cost**: $1,999 × 1,000 = **$1.99M** (vs ~$35M for equivalent H100 capacity)

**Operating cost per year**:
- Power: 250kW × 8,760 hr × $0.08/kWh = **$175,200/yr**
- Colocation (20 racks): ~$2,000/rack/month = **$480,000/yr**
- Staff (2 FTE for fleet management): ~**$300,000/yr**
- Hardware refresh (10%/yr): **$199,000/yr**
- **Total: ~$1.15M/year**

**Revenue potential** (selling inference capacity):
- 1,000 × 36GB = 36TB RAM → run 500× 70B models simultaneously
- At $0.50/million tokens, ~100M tokens/day/model:
- 500 models × 100M tokens × $0.50/1M = **$25,000/day = $9.1M/year**
- After costs: **~$8M/year profit**

**Why this model works**:
1. No per-token cloud markup
2. Apple Silicon: best tokens/watt ratio of any hardware (2024)
3. 36–192GB unified memory enables models that can't run on 24GB Nvidia GPUs
4. No CUDA licensing or driver compatibility issues
5. macOS stability — Mac Minis can run 200+ days without reboot

---

## Fleet Management Patterns at Scale

### Configuration Management
- **Small fleet (< 50)**: Ansible playbooks, SSH-based
- **Medium fleet (50–500)**: Puppet/Chef with central config server; Apple Remote Desktop for GUI tasks
- **Large fleet (500+)**: MDM (Mobile Device Management) — Jamf Pro is the Mac-specific standard; combines config management + remote wipe + software deployment

### Monitoring Stack for Mac Fleets
```
Mac Mini Agents
└── Telegraf (metrics collector)
    └── InfluxDB (time-series store)
        └── Grafana (dashboards)
            └── PagerDuty (alerting)
```
- Key metrics: CPU utilization per core (efficiency vs performance cores), GPU utilization (Metal), memory pressure (unified memory), Ollama inference latency, disk I/O

### Networking
- **Recommended**: 2.5GbE minimum, 10GbE for inference clusters (model weight loading is bandwidth-bound)
- Mac Mini M3 has built-in 10GbE option — use it
- VLAN separation: inference network vs management network
- NFS/AFP for shared model weight storage (avoid downloading same 40GB model to 100 machines)

### Auto-Recovery Patterns
```
Watchdog script (cron every 5min):
  1. Check process list for ollama/agentCLI
  2. If missing → restart
  3. If hung (no progress for 10min) → kill + restart
  4. If 3 consecutive failures → alert + disable node
  5. Log all events to central log server
```

### OpenClaw at Fleet Scale
Your current architecture handles this well. Scaling considerations:
- SQLite → PostgreSQL at ~50 concurrent agents (SQLite write lock becomes bottleneck)
- WebSocket server → Redis pub/sub backend at ~200 concurrent connections
- Single `runAutoAssignmentSweep()` → distributed lock (Redis SETNX) to prevent duplicate assignment across multiple server instances
- `machines` table already exists — extend with `status`, `last_seen`, `capacity` columns for proper fleet management
