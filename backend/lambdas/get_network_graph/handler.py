"""
Lambda: get-network-graph

Returns the scam network graph (nodes + edges) for the D3.js visualization.
Reads graph data from PostgreSQL and supports optional focal_node and
min_risk_score filters.
"""

import json
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from shared.db import query_network_graph
from shared.models import generate_request_id


def handler(event, context):
    """AWS Lambda handler for GET /api/network-graph."""
    query = event.get("queryStringParameters", {}) or {}

    focal_node = query.get("focal_node")
    min_risk_score = int(query.get("min_risk_score", "0"))

    graph = query_network_graph()
    nodes = graph["nodes"]
    edges = graph["edges"]

    if min_risk_score > 0:
        valid_ids = {n["id"] for n in nodes if n.get("risk_score", 0) >= min_risk_score}
        nodes = [n for n in nodes if n["id"] in valid_ids]
        edges = [e for e in edges if e["source"] in valid_ids and e["target"] in valid_ids]

    if focal_node:
        nodes, edges = _subgraph(nodes, edges, focal_node, hops=2)

    for node in nodes:
        node["is_focal"] = node["id"] == focal_node if focal_node else False

    response = {
        "request_id": generate_request_id(),
        "nodes": nodes,
        "edges": edges,
        "cluster_count": 0,
        "total_nodes": len(nodes),
        "total_edges": len(edges),
    }

    return {
        "statusCode": 200,
        "headers": _cors_headers(),
        "body": json.dumps(response, default=str),
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
