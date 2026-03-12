# Mode: Data Pipeline
## Overview
ETL/ELT or streaming data architecture. Ingestion from multiple sources, transformation, storage in data warehouse, monitoring and alerting.
## Architecture Template
- Ingestion: Apache Kafka or AWS Kinesis
- Processing: Apache Spark or dbt for transformations
- Storage: Snowflake / BigQuery / Redshift
- Orchestration: Airflow or Prefect
- Monitoring: Great Expectations for data quality
- Visualization: Metabase or Superset
## Task Breakdown Template
1. Source connectors (APIs, databases, files)
2. Schema design + data contracts
3. Transformation layer
4. Data quality checks
5. Orchestration DAGs
6. Warehouse loading
7. Monitoring + alerting
8. Data catalog / documentation
## Team Composition
- Data Engineering: 2 workers
- Backend: 1 worker (API sources)
- DevOps: 1 worker
- Performance: 1 worker
## Model Recommendations
- Data Engineering: claude-sonnet (complex transformation logic)
- DevOps: claude-haiku (infra configs)
## Common Pitfalls
- Schema drift from upstream sources
- Late-arriving data handling
- Incremental vs full refresh strategy
- Cost explosion from unoptimized warehouse queries
