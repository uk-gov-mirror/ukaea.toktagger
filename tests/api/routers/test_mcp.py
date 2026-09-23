import pytest


@pytest.mark.asyncio
async def test_tools_available(mcp_client):
    tools = await mcp_client.list_tools()
    assert len(tools) > 0


@pytest.mark.asyncio
async def test_get(mcp_client, setup_db):
    result = await mcp_client.call_tool(
        "get_projects",
    )
    assert result is not None
    projects = result.structured_content.get("result", [])
    assert len(projects) == 3
    assert sorted([project["name"] for project in projects]) == [
        "project_2",
        "test_project_0",
        "test_project_1",
    ]


@pytest.mark.asyncio
async def test_get_filtered(mcp_client, setup_db):
    result = await mcp_client.call_tool("get_projects", arguments={"name": "test"})
    assert result is not None
    projects = result.structured_content.get("result", [])
    assert len(projects) == 2
    assert sorted([project["name"] for project in projects]) == [
        "test_project_0",
        "test_project_1",
    ]
