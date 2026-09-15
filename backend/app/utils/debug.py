import json
import time
import uuid
import hashlib
from typing import Dict, Any, List, Optional, Union
from datetime import datetime
from dataclasses import dataclass, asdict
from enum import Enum

from ..models.output import DevTrace
from ..utils.logger import get_logger

logger = get_logger(__name__)


class DebugLevel(str, Enum):
    BASIC = "basic"
    VERBOSE = "verbose"
    TRACE = "trace"


@dataclass
class DebugContext:
    """Context for debug operations"""
    enabled: bool = False
    level: DebugLevel = DebugLevel.BASIC
    include_prompts: bool = False
    include_state_patches: bool = False
    include_memory_ops: bool = False
    include_risk_resolution: bool = False
    include_timing: bool = False
    session_id: Optional[str] = None
    step_id: Optional[str] = None
    
    @classmethod
    def from_config(cls, config: Optional[Dict[str, Any]]) -> 'DebugContext':
        """Create debug context from configuration dict"""
        if not config or not config.get("enabled", False):
            return cls(enabled=False)
        
        include = config.get("include", {})
        
        return cls(
            enabled=True,
            level=DebugLevel(config.get("level", "basic")),
            include_prompts=include.get("prompts", False),
            include_state_patches=include.get("state_patches", False),
            include_memory_ops=include.get("memory_ops", False),
            include_risk_resolution=include.get("risk_resolution", False),
            include_timing=include.get("timing", False),
            session_id=config.get("session_id"),
            step_id=str(uuid.uuid4())[:8]
        )


class DebugTracer:
    """Main debug tracing system for Aventra"""
    
    def __init__(self):
        self.active_traces: Dict[str, DevTrace] = {}
    
    def start_trace(self, context: DebugContext, inputs: Dict[str, Any]) -> str:
        """Start a new debug trace"""
        if not context.enabled:
            return ""
        
        step_id = context.step_id or str(uuid.uuid4())[:8]
        
        # Create state digest for inputs
        state_digest = self._create_state_digest(inputs.get("state", {}))
        
        trace_inputs = {
            "user_input": inputs.get("user_input"),
            "state_digest": state_digest
        }
        
        trace = DevTrace(
            step_id=step_id,
            inputs=trace_inputs
        )
        
        self.active_traces[step_id] = trace
        
        if context.level in [DebugLevel.VERBOSE, DebugLevel.TRACE]:
            logger.debug(f"Started trace [{step_id}] with inputs: {trace_inputs}")
        
        return step_id
    
    def add_prompt_info(self, step_id: str, context: DebugContext, system: str, user: str, tools: Optional[List[str]] = None):
        """Add prompt information to trace"""
        if not context.enabled or not context.include_prompts or step_id not in self.active_traces:
            return
        
        self.active_traces[step_id].prompt = {
            "system": system if context.level == DebugLevel.TRACE else system[:200] + "...",
            "user": user if context.level == DebugLevel.TRACE else user[:200] + "...",
            "tools": tools or []
        }
    
    def add_llm_output(self, step_id: str, context: DebugContext, raw_output: str, parsed_output: Dict[str, Any]):
        """Add LLM output information to trace"""
        if not context.enabled or step_id not in self.active_traces:
            return
        
        trace = self.active_traces[step_id]
        
        # Store raw output if in trace mode
        if context.level == DebugLevel.TRACE:
            trace.llm_output_raw = raw_output
        
        # Always store parsed summary
        trace.parsed = {
            "narration_excerpt": parsed_output.get("narration", "")[:100] + "...",
            "state_patch_keys": list(parsed_output.get("state_changes", {}).keys()) if parsed_output.get("state_changes") else [],
            "actions_count": len(parsed_output.get("actions", []))
        }
    
    def add_state_patch(self, step_id: str, context: DebugContext, patch_data: Dict[str, Any]):
        """Add state patch information to trace"""
        if not context.enabled or not context.include_state_patches or step_id not in self.active_traces:
            return
        
        # Store patch data (sanitized for size)
        if context.level == DebugLevel.TRACE:
            self.active_traces[step_id].state_patch = patch_data
        else:
            # Store only keys and counts for basic/verbose
            self.active_traces[step_id].state_patch = {
                "patch_count": len(patch_data.get("operations", [])),
                "affected_paths": [op.get("path") for op in patch_data.get("operations", [])]
            }
    
    def add_memory_ops(self, step_id: str, context: DebugContext, memory_info: Dict[str, Any]):
        """Add memory operation information to trace"""
        if not context.enabled or not context.include_memory_ops or step_id not in self.active_traces:
            return
        
        self.active_traces[step_id].memory_ops = {
            "summaries_updated": memory_info.get("summaries_updated", False),
            "tokens_before": memory_info.get("tokens_before", 0),
            "tokens_after": memory_info.get("tokens_after", 0)
        }
    
    def add_risk_resolution(self, step_id: str, context: DebugContext, risk_info: Dict[str, Any]):
        """Add risk resolution information to trace"""
        if not context.enabled or not context.include_risk_resolution or step_id not in self.active_traces:
            return
        
        self.active_traces[step_id].risk_resolution = {
            "action_id": risk_info.get("action_id"),
            "risk": risk_info.get("risk"),
            "outcome": risk_info.get("outcome")
        }
    
    def add_timing(self, step_id: str, context: DebugContext, timing_info: Dict[str, Any]):
        """Add timing information to trace"""
        if not context.enabled or not context.include_timing or step_id not in self.active_traces:
            return
        
        self.active_traces[step_id].timing = timing_info
    
    def add_warning(self, step_id: str, context: DebugContext, warning: str):
        """Add warning to trace"""
        if not context.enabled or step_id not in self.active_traces:
            return
        
        if not self.active_traces[step_id].warnings:
            self.active_traces[step_id].warnings = []
        
        self.active_traces[step_id].warnings.append(warning)
        
        if context.level in [DebugLevel.VERBOSE, DebugLevel.TRACE]:
            logger.warning(f"Trace [{step_id}] warning: {warning}")
    
    def finalize_trace(self, step_id: str, context: DebugContext) -> Optional[DevTrace]:
        """Finalize and return trace"""
        if not context.enabled or step_id not in self.active_traces:
            return None
        
        trace = self.active_traces.pop(step_id)
        
        # Log trace summary if verbose or trace level
        if context.level in [DebugLevel.VERBOSE, DebugLevel.TRACE]:
            self._log_trace_summary(trace, context.level)
        
        return trace
    
    def _create_state_digest(self, state: Dict[str, Any]) -> str:
        """Create digest of state for tracking"""
        if not state:
            return "empty"
        
        # Create a hash of key state elements
        key_elements = {
            "scene_id": state.get("scene", {}).get("id"),
            "character_count": len(state.get("characters", [])),
            "inventory_count": len(state.get("inventory", [])),
            "monster_count": len(state.get("monsters", [])),
            "turn": state.get("story_position", {}).get("turn", 0)
        }
        
        digest_str = json.dumps(key_elements, sort_keys=True)
        return hashlib.md5(digest_str.encode()).hexdigest()[:8]
    
    def _log_trace_summary(self, trace: DevTrace, level: DebugLevel):
        """Log trace summary"""
        summary = f"Trace [{trace.step_id}] completed:"
        
        if trace.parsed:
            summary += f" narration={len(trace.parsed.get('narration_excerpt', ''))}"
            summary += f" actions={trace.parsed.get('actions_count', 0)}"
        
        if trace.timing:
            summary += f" time={trace.timing.get('total_ms', 0):.1f}ms"
        
        if trace.warnings:
            summary += f" warnings={len(trace.warnings)}"
        
        logger.debug(summary)


class PerformanceMonitor:
    """Monitor performance metrics for debug purposes"""
    
    def __init__(self):
        self.start_times: Dict[str, float] = {}
        self.metrics: Dict[str, List[float]] = {}
    
    def start_timer(self, operation: str) -> str:
        """Start timing an operation"""
        timer_id = f"{operation}_{int(time.time() * 1000)}"
        self.start_times[timer_id] = time.time()
        return timer_id
    
    def end_timer(self, timer_id: str) -> float:
        """End timing and return duration in ms"""
        if timer_id not in self.start_times:
            return 0.0
        
        duration = (time.time() - self.start_times.pop(timer_id)) * 1000
        return duration
    
    def record_metric(self, metric_name: str, value: float):
        """Record a performance metric"""
        if metric_name not in self.metrics:
            self.metrics[metric_name] = []
        
        self.metrics[metric_name].append(value)
        
        # Keep only last 100 measurements
        if len(self.metrics[metric_name]) > 100:
            self.metrics[metric_name] = self.metrics[metric_name][-100:]
    
    def get_stats(self, metric_name: str) -> Dict[str, float]:
        """Get statistics for a metric"""
        if metric_name not in self.metrics or not self.metrics[metric_name]:
            return {}
        
        values = self.metrics[metric_name]
        return {
            "count": len(values),
            "avg": sum(values) / len(values),
            "min": min(values),
            "max": max(values),
            "recent": values[-1] if values else 0
        }


# Global instances
debug_tracer = DebugTracer()
performance_monitor = PerformanceMonitor()


def create_debug_context(config: Optional[Dict[str, Any]]) -> DebugContext:
    """Create debug context from configuration"""
    return DebugContext.from_config(config)


def log_performance_metric(metric_name: str, value: float):
    """Log a performance metric"""
    performance_monitor.record_metric(metric_name, value)


def get_performance_stats() -> Dict[str, Dict[str, float]]:
    """Get all performance statistics"""
    return {
        metric: performance_monitor.get_stats(metric)
        for metric in performance_monitor.metrics.keys()
    }