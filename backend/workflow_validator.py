"""
Workflow validator with comprehensive checks:
- Valid node types
- Duplicate IDs
- Required fields per node type
- Edges reference valid node IDs
- Every non-ending node has at least one outgoing edge
- Every node is reachable from the first node (BFS)
"""
from workflow_generator import VALID_NODE_TYPES, NODE_SCHEMAS
from collections import deque


def validate(workflow: dict) -> dict:
    errors = []
    nodes = workflow.get("nodes", [])
    edges = workflow.get("edges", [])

    node_ids = set()
    node_types = {}

    # 1. Duplicate node IDs
    for n in nodes:
        nid = n.get("id")
        if not nid:
            errors.append("Node missing 'id'")
            continue
        if nid in node_ids:
            errors.append(f"Duplicate node ID: {nid}")
        node_ids.add(nid)
        node_types[nid] = n.get("type", "")

    # 2. Valid node types + required fields
    for n in nodes:
        ntype = n.get("type", "")
        nid = n.get("id", "?")
        if ntype not in VALID_NODE_TYPES:
            errors.append(f"Node '{nid}': unknown type '{ntype}'")
            continue
        schema = NODE_SCHEMAS.get(ntype, {})
        data = n.get("data", {})
        for req in schema.get("required", []):
            if not data.get(req):
                errors.append(f"Node '{nid}' ({ntype}): missing required field '{req}'")

    # 3. Edge endpoints reference valid nodes
    out_edges: dict[str, list] = {nid: [] for nid in node_ids}
    for e in edges:
        src = e.get("source")
        tgt = e.get("target")
        if src not in node_ids:
            errors.append(f"Edge '{e.get('id', '?')}': invalid source '{src}'")
        if tgt not in node_ids:
            errors.append(f"Edge '{e.get('id', '?')}': invalid target '{tgt}'")
        if src in out_edges:
            out_edges[src].append(tgt)

    # 4. Duplicate edge IDs
    edge_ids = set()
    for e in edges:
        eid = e.get("id")
        if eid and eid in edge_ids:
            errors.append(f"Duplicate edge ID: {eid}")
        if eid:
            edge_ids.add(eid)

    # 5. Non-ending nodes must have outgoing edges
    for nid, ntype in node_types.items():
        if ntype not in ("ending", "note") and not out_edges.get(nid):
            errors.append(f"Node '{nid}' ({ntype}): no outgoing edges (dead end)")

    # 6. Reachability BFS from first node
    if nodes:
        start_id = nodes[0]["id"]
        visited = {start_id}
        queue = deque([start_id])
        while queue:
            cur = queue.popleft()
            for nxt in out_edges.get(cur, []):
                if nxt not in visited:
                    visited.add(nxt)
                    queue.append(nxt)
        unreachable = node_ids - visited
        for uid in unreachable:
            errors.append(f"Node '{uid}' is unreachable from the start node")

    return {"valid": len(errors) == 0, "errors": errors}
