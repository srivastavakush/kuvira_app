"""Kuvira AI Coach — video-first, sensor-optional coaching system.

Module layout:
  models.py           — pydantic schemas for matches, videos, jobs, reports
  providers/          — AIProvider abstraction (OpenAI default)
  analyzer/           — VideoAnalyzer abstraction (lightweight OpenCV default)
  retriever/          — KnowledgeRetriever abstraction (Mongo cosine default)
  graph.py            — LangGraph coaching workflow
  jobs.py             — async analysis job runner
  router.py           — FastAPI routes
  knowledge_seed.py   — coaching knowledge base seed
"""
