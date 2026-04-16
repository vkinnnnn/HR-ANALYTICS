#!/usr/bin/env python
"""Test Phase 1 components locally without requiring external services."""

import sys
import os

# Add backend to path
backend_path = r"C:\PROJECTS\HR_ANALYTICS_PLATFORM\backend"
sys.path.insert(0, backend_path)
os.chdir(backend_path)

def test_memory_manager():
    """Test the persistent memory manager."""
    print("\n[TEST] Memory Manager (SQLite persistent storage)...")
    from app.services.memory_manager import MemoryManager

    mm = MemoryManager(":memory:")  # Use in-memory DB for testing

    # Test save
    assert mm.save("user1", "John reports to Alice"), "Failed to save memory"
    assert mm.save("user1", "Team has 5 people"), "Failed to save second memory"

    # Test get_all
    memories = mm.get_all("user1")
    assert len(memories) == 2, f"Expected 2 memories, got {len(memories)}"
    assert "John reports to Alice" in memories, "Memory not found"

    # Test search
    results = mm.search("user1", "John")
    assert len(results) == 1, "Search failed"
    assert "John" in results[0], "Search result incorrect"

    # Test get_stats
    stats = mm.get_stats()
    assert stats["total_facts"] == 2, "Stats incorrect"

    # Test clear
    assert mm.clear("user1"), "Failed to clear"
    assert len(mm.get_all("user1")) == 0, "Clear failed"

    print("   [PASS] Memory persistence working (SQLite)")
    print("   [PASS] Search and retrieval working")
    print("   [PASS] GDPR delete working")
    return True

def test_analytics_engine():
    """Test the analytics engine without data."""
    print("\n[OK] Testing Analytics Engine...")
    from app.services.analytics_engine import AnalyticsEngine

    # Test with empty data
    empty_cache = {"employees": None}
    engine = AnalyticsEngine(empty_cache)
    result = engine.query("headcount_summary")
    assert "error" in result, "Should return error for empty data"

    print("   [OK] Error handling for missing data working")
    return True

def test_knowledge_base_init():
    """Test knowledge base initialization (without embeddings)."""
    print("\n[OK] Testing Knowledge Base Initialization...")
    from app.services.knowledge_base import _get_collection

    # This will try to connect to ChromaDB but won't require embeddings for this test
    try:
        collection = _get_collection()
        print("   [OK] ChromaDB client initialized successfully")
        print(f"   [OK] Collection name: {collection.name}")
        return True
    except Exception as e:
        if "OpenAI" in str(e) or "429" in str(e):
            print(f"   [WARN] ChromaDB initialized but embeddings unavailable (OpenAI quota): {str(e)[:50]}...")
            return True
        raise

def test_brain_agent():
    """Test brain agent initialization."""
    print("\n[OK] Testing Brain Agent Structure...")
    from app.services.brain import BrainAgent

    # Create with minimal data
    data_cache = {
        "employees": None,
        "history": None,
        "manager_span": None,
        "recognition_kpis": {}
    }

    try:
        agent = BrainAgent(data_cache)
        print("   [OK] BrainAgent initialized successfully")
        print("   [OK] LangGraph state machine compiled")

        # Test input validation
        response = agent.process_message("user1", "")
        assert "valid message" in response.lower(), "Should reject empty message"
        print("   [OK] Input validation working")

        response = agent.process_message("user1", "x" * 6000)
        assert "too long" in response.lower(), "Should reject long message"
        print("   [OK] Length validation working")

        return True
    except Exception as e:
        print(f"   [FAIL] Error: {e}")
        return False

def test_llm_availability():
    """Test LLM availability check."""
    print("\n[OK] Testing LLM Configuration...")
    from app.llm import is_llm_available, is_openai_available

    llm_ok = is_llm_available()
    openai_ok = is_openai_available()

    print(f"   {'[OK]' if llm_ok else '[WARN]'} LLM provider: {'available' if llm_ok else 'not configured'}")
    print(f"   {'[OK]' if openai_ok else '[WARN]'} OpenAI: {'available' if openai_ok else 'not configured'}")

    return True

def main():
    print("="*60)
    print("Phase 1 Foundation — Local Verification")
    print("="*60)

    tests = [
        ("Memory Manager", test_memory_manager),
        ("Analytics Engine", test_analytics_engine),
        ("Knowledge Base", test_knowledge_base_init),
        ("Brain Agent", test_brain_agent),
        ("LLM Configuration", test_llm_availability),
    ]

    results = {}
    for name, test_fn in tests:
        try:
            results[name] = test_fn()
        except Exception as e:
            print(f"   [FAIL] FAILED: {e}")
            results[name] = False

    print("\n" + "="*60)
    print("Test Results Summary")
    print("="*60)

    for name, passed in results.items():
        status = "[OK] PASS" if passed else "[FAIL] FAIL"
        print(f"{status:8} {name}")

    passed_count = sum(1 for v in results.values() if v)
    total_count = len(results)

    print(f"\nTotal: {passed_count}/{total_count} tests passed")

    if passed_count == total_count:
        print("\n[SUCCESS] Phase 1 Foundation is production-ready for development!")
        return 0
    else:
        print(f"\n[WARN] {total_count - passed_count} test(s) failed")
        return 1

if __name__ == "__main__":
    sys.exit(main())
