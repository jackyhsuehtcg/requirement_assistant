import sqlite3
import logging
from datetime import datetime, timedelta
from app.schemas import RefineRequest

DB_PATH = "analytics.db"
logger = logging.getLogger("uvicorn")

def init_db():
    """Initialize the SQLite database for analytics."""
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS request_logs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
                project_key TEXT,
                issue_type TEXT,
                component_team TEXT,
                summary_length INTEGER,
                output_language TEXT
            )
        """)
        conn.commit()
        conn.close()
        logger.info("Analytics DB initialized.")
    except Exception as e:
        logger.error(f"Failed to init analytics DB: {e}")

def log_usage(request: RefineRequest):
    """Log a usage event to the database."""
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO request_logs 
            (project_key, issue_type, component_team, summary_length, output_language)
            VALUES (?, ?, ?, ?, ?)
        """, (
            request.project_key,
            request.issue_type,
            request.component_team,
            len(request.summary) if request.summary else 0,
            request.output_language
        ))
        conn.commit()
        conn.close()
    except Exception as e:
        logger.error(f"Failed to log usage: {e}")

def get_usage_stats(period: str = "weekly"):
    """Get usage counts grouped by period (daily, weekly, monthly)."""
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        
        if period == "daily":
            # Last 30 days
            query = """
                SELECT 
                    date(timestamp) as time_group,
                    COUNT(*) as count
                FROM request_logs
                GROUP BY time_group
                ORDER BY time_group DESC
                LIMIT 30
            """
        elif period == "monthly":
            # Last 12 months
            query = """
                SELECT 
                    strftime('%Y-%m', timestamp) as time_group,
                    COUNT(*) as count
                FROM request_logs
                GROUP BY time_group
                ORDER BY time_group DESC
                LIMIT 12
            """
        else: # weekly default
            query = """
                SELECT 
                    strftime('%Y-%W', timestamp) as time_group,
                    COUNT(*) as count,
                    min(date(timestamp)) as week_start
                FROM request_logs
                GROUP BY time_group
                ORDER BY time_group DESC
                LIMIT 12
            """

        cursor.execute(query)
        rows = cursor.fetchall()
        conn.close()
        
        # Format for chart
        labels = []
        data = []
        
        for row in rows:
            if period == "weekly":
                 # row[0] is year-week, row[1] is count, row[2] is start date
                labels.append(f"Week {row[0]} ({row[2]})")
                data.append(row[1])
            else:
                # row[0] is date/month, row[1] is count
                labels.append(row[0])
                data.append(row[1])
            
        return {
            "labels": labels[::-1],
            "data": data[::-1]
        }
    except Exception as e:
        logger.error(f"Failed to get analytics: {e}")
        return {"labels": [], "data": []}
