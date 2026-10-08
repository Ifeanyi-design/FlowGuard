"""Bank integration abstraction. MVP uses MockBankAdapter (no real money)."""
from __future__ import annotations

from abc import ABC, abstractmethod


class BankAdapter(ABC):
    @abstractmethod
    def get_account(self, account_number: str) -> dict:
        raise NotImplementedError

    @abstractmethod
    def authorize(self, reference: str, amount: float, decision: str) -> dict:
        """Simulate core-bank authorization. Never moves real money."""
        raise NotImplementedError

    @abstractmethod
    def account_status(self, account_number: str) -> str:
        raise NotImplementedError


class MockBankAdapter(BankAdapter):
    """Realistic mock: ledger is source of truth (in-memory + DB mirror)."""

    def get_account(self, account_number: str) -> dict:
        return {"account_number": account_number, "status": "active", "ledger": "mock-core"}

    def authorize(self, reference: str, amount: float, decision: str) -> dict:
        if decision == "APPROVE":
            return {"reference": reference, "authorized": True, "status": "authorized", "ledger": "mock-core"}
        if decision == "BLOCK":
            return {"reference": reference, "authorized": False, "status": "declined", "ledger": "mock-core"}
        return {"reference": reference, "authorized": False, "status": "pending_review", "ledger": "mock-core"}

    def account_status(self, account_number: str) -> str:
        return "active"


_adapter: BankAdapter = MockBankAdapter()


def get_adapter() -> BankAdapter:
    return _adapter
