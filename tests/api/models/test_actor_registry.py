"""Actor bookkeeping in ActorRegistry.

Exercised against the undecorated class rather than a live Ray actor: the eviction
choice is plain logic, and driving it through ray.remote would need a cluster to
assert something no cluster is involved in.
"""

import pytest

pytest.importorskip("ray")

from toktagger.api.models.base import ActorRegistry

# @ray.remote replaces the class with an ActorClass handle; this is the original.
Registry = ActorRegistry.__ray_metadata__.modified_class

pytestmark = pytest.mark.models_enabled


def test_gpu_eviction_is_skipped_when_gpu_support_is_off():
    """A GPU actor must not be evicted the moment it is registered.

    max_gpu_actors=0 means GPU support is off, so the GPU limit does not apply and
    the overall actor limit governs. Reading the gpu_enabled *method* instead of the
    flag made this condition always true, which took the GPU branch and evicted the
    actor that had just been registered.
    """
    registry = Registry(max_actors=3, max_gpu_actors=0)
    assert registry._gpu_enabled is False

    registry.update_actors("first", use_gpu=True)

    assert registry.list_actors() == ["first"]


def test_actors_are_evicted_least_recently_used_first():
    """Past the overall limit, the oldest untouched actor goes."""
    registry = Registry(max_actors=2, max_gpu_actors=0)

    registry.update_actors("a", use_gpu=False)
    registry.update_actors("b", use_gpu=False)
    registry.update_actors("a", use_gpu=False)  # a is now the most recent
    registry.update_actors("c", use_gpu=False)

    assert registry.list_actors() == ["a", "c"]


def test_gpu_limit_evicts_a_gpu_actor_when_gpu_support_is_on():
    """With GPU support on, exceeding max_gpu_actors evicts a GPU actor."""
    registry = Registry(max_actors=5, max_gpu_actors=1)
    assert registry._gpu_enabled is True

    registry.update_actors("cpu", use_gpu=False)
    registry.update_actors("gpu_one", use_gpu=True)
    registry.update_actors("gpu_two", use_gpu=True)

    remaining = registry.list_actors()
    assert "cpu" in remaining, "the CPU actor is under neither limit"
    assert remaining.count("gpu_one") + remaining.count("gpu_two") == 1


def test_a_cpu_actor_can_be_upgraded_to_gpu():
    """Recorded the other way round it would be treated as CPU-only forever."""
    registry = Registry(max_actors=3, max_gpu_actors=2)

    registry.update_actors("worker", use_gpu=False)
    assert registry.actors["worker"] is False

    registry.update_actors("worker", use_gpu=True)
    assert registry.actors["worker"] is True

    registry.update_actors("worker", use_gpu=False)
    assert registry.actors["worker"] is True, "a GPU actor must not downgrade"


def test_zero_max_actors_is_rejected():
    """The registry cannot function with no CPU budget at all."""
    with pytest.raises(ValueError, match="Insufficient CPU cores"):
        Registry(max_actors=0, max_gpu_actors=0)
