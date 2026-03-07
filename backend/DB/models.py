from sqlalchemy import Text, DateTime, func
from sqlalchemy.orm import Mapped, mapped_column
from DB.db import Base

class Interaction(Base):
    __tablename__ = "interactions"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_request: Mapped[str] = mapped_column(Text, nullable=False)
    llm_response: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[str] = mapped_column(DateTime(timezone=True), server_default=func.now())