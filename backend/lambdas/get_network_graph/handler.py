"""
Lambda: get-network-graph

Returns the scam network graph (nodes + edges) for the D3.js visualization.
Reads pre-built graph data from Alibaba OSS (or returns embedded mock data
for hackathon demo).

Supports optional focal_node and min_risk_score query parameters
to filter the subgraph.
"""

import json
import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from shared.models import generate_request_id

# ---------------------------------------------------------------------------
# Mock graph data (PRD Section 11 — 3 scam clusters)
# In production, this would be fetched from Alibaba OSS via signed URL
# ---------------------------------------------------------------------------
MOCK_GRAPH = {
    "nodes": [
        # Cluster 1: Macau scam ring (4 mule accounts + 1 shared device)
        {"id": "60123456789", "type": "account", "label": "Acct ***789", "risk_score": 87, "status": "blocked", "account_age_days": 6, "cluster_id": 1},
        {"id": "60198765432", "type": "account", "label": "Acct ***432", "risk_score": 76, "status": "open", "account_age_days": 11, "cluster_id": 1},
        {"id": "60155443322", "type": "account", "label": "Acct ***322", "risk_score": 81, "status": "open", "account_age_days": 3, "cluster_id": 1},
        {"id": "60177665544", "type": "account", "label": "Acct ***544", "risk_score": 72, "status": "flagged", "account_age_days": 9, "cluster_id": 1},
        {"id": "DEV-abc123", "type": "device", "label": "Device ***123", "risk_score": 82, "status": "flagged", "cluster_id": 1},
        # Cluster 2: Account takeover ring (3 accounts + shared IP/registration)
        {"id": "60133221100", "type": "account", "label": "Acct ***100", "risk_score": 68, "status": "open", "account_age_days": 2, "cluster_id": 2},
        {"id": "60144332211", "type": "account", "label": "Acct ***211", "risk_score": 71, "status": "flagged", "account_age_days": 2, "cluster_id": 2},
        {"id": "60155443300", "type": "account", "label": "Acct ***300", "risk_score": 65, "status": "open", "account_age_days": 3, "cluster_id": 2},
        {"id": "DEV-def456", "type": "device", "label": "Device ***456", "risk_score": 70, "status": "flagged", "cluster_id": 2},
        # Cluster 3: Isolated mule
        {"id": "60166554433", "type": "account", "label": "Acct ***433", "risk_score": 58, "status": "open", "account_age_days": 7, "cluster_id": 3},
        # Legitimate accounts (low risk)
        {"id": "60100001111", "type": "account", "label": "Acct ***111", "risk_score": 5, "status": "normal", "account_age_days": 1240, "cluster_id": 0},
        {"id": "60100002222", "type": "account", "label": "Acct ***222", "risk_score": 8, "status": "normal", "account_age_days": 980, "cluster_id": 0},
    ],
    "edges": [
        # Cluster 1 edges
        {"id": "e-001", "source": "60123456789", "target": "DEV-abc123", "relationship": "used_device", "weight": 1.0, "label": "Transaction device"},
        {"id": "e-002", "source": "60198765432", "target": "DEV-abc123", "relationship": "shared_device", "weight": 0.9, "label": "Same device fingerprint"},
        {"id": "e-003", "source": "60155443322", "target": "DEV-abc123", "relationship": "shared_device", "weight": 0.9, "label": "Same device fingerprint"},
        {"id": "e-004", "source": "60177665544", "target": "DEV-abc123", "relationship": "shared_device", "weight": 0.8, "label": "Same device fingerprint"},
        {"id": "e-005", "source": "60123456789", "target": "60198765432", "relationship": "transaction", "weight": 0.7, "label": "Fund transfer"},
        {"id": "e-006", "source": "60155443322", "target": "60177665544", "relationship": "same_registration_time", "weight": 0.6, "label": "Registered within 1 hour"},
        # Cluster 2 edges
        {"id": "e-007", "source": "60133221100", "target": "DEV-def456", "relationship": "shared_device", "weight": 0.9, "label": "Same device"},
        {"id": "e-008", "source": "60144332211", "target": "DEV-def456", "relationship": "shared_device", "weight": 0.9, "label": "Same device"},
        {"id": "e-009", "source": "60133221100", "target": "60144332211", "relationship": "same_ip", "weight": 0.85, "label": "Same IP address"},
        {"id": "e-010", "source": "60144332211", "target": "60155443300", "relationship": "same_registration_time", "weight": 0.7, "label": "Registered same day"},
        # Cross-cluster
        {"id": "e-011", "source": "60100001111", "target": "60123456789", "relationship": "transaction", "weight": 0.3, "label": "Victim transfer"},
        {"id": "e-012", "source": "60100002222", "target": "60198765432", "relationship": "transaction", "weight": 0.25, "label": "Victim transfer"},
    ],
}


def handler(event, context):
    """AWS Lambda handler for GET /api/network-graph."""
    query = event.get("queryStringParameters", {}) or {}

    focal_node = query.get("focal_node")
    min_risk_score = int(query.get("min_risk_score", "0"))

    nodes = MOCK_GRAPH["nodes"]
    edges = MOCK_GRAPH["edges"]

    # Filter by min_risk_score
    if min_risk_score > 0:
        valid_ids = {n["id"] for n in nodes if n.get("risk_score", 0) >= min_risk_score}
        nodes = [n for n in nodes if n["id"] in valid_ids]
        edges = [e for e in edges if e["source"] in valid_ids and e["target"] in valid_ids]

    # Filter by focal_node (2-hop subgraph)
    if focal_node:
        nodes, edges = _subgraph(nodes, edges, focal_node, hops=2)

    # Set is_focal flag
    for n in nodes:
        n["is_focal"] = n["id"] == focal_node if focal_node else False

    response = {
        "request_id": generate_request_id(),
        "nodes": nodes,
        "edges": edges,
        "cluster_count": len({n.get("cluster_id", 0) for n in nodes if n.get("cluster_id", 0) > 0}),
        "total_nodes": len(nodes),
        "total_edges": len(edges),
    }

    return {
        "statusCode": 200,
        "headers": _cors_headers(),
        "body": json.dumps(response),
    }


def _subgraph(nodes, edges, focal_id, hops=2):
    """Extract subgraph within N hops of focal node."""
    node_map = {n["id"]: n for n in nodes}
    if focal_id not in node_map:
        return nodes, edges

    visited = {focal_id}
    frontier = {focal_id}

    for _ in range(hops):
        next_frontier = set()
        for edge in edges:
            if edge["source"] in frontier:
                next_frontier.add(edge["target"])
            if edge["target"] in frontier:
                next_frontier.add(edge["source"])
        frontier = next_frontier - visited
        visited |= frontier

    filtered_nodes = [n for n in nodes if n["id"] in visited]
    filtered_edges = [e for e in edges if e["source"] in visited and e["target"] in visited]
    return filtered_nodes, filtered_edges


def _cors_headers():
    return {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type,x-api-key",
        "Access-Control-Allow-Methods": "GET,OPTIONS",
    }
