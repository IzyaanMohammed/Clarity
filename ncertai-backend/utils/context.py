import contextvars

board_var = contextvars.ContextVar("board", default="CBSE")
language_var = contextvars.ContextVar("language", default="English")
