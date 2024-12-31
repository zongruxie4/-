import click
import asyncio
from langchain.chat_models import init_chat_model
from nanobrowser.lib.config.config import NanoConfig
from nanobrowser.lib.agent.executor import Executor
from nanobrowser.lib.websocket.server import start_server
from nanobrowser.lib.utils.time_utils import generate_new_task_id
from pathlib import Path

async def _setup_executor(config: NanoConfig):
    llm_planner = init_chat_model(
        model=config.planner.model,
        model_provider=config.planner.model_provider,
        **config.planner.inference_config
    )

    llm_navigator = init_chat_model(
        model=config.navigator.model,
        model_provider=config.navigator.model_provider,
        **config.navigator.inference_config
    )

    executor = Executor(
        config.base_dir,
        llm_planner,
        llm_navigator,
        chrome_app_path=config.browser.chrome_app_path,
        chrome_cdp_port=config.browser.cdp_port,
        max_steps=config.max_steps,
        max_errors=config.max_errors,
    )

    try:
        await executor.initialize()
        return executor
    except Exception as e:
        print(f"Error: {e}")
        print("Failed to initialize executor. Exiting.")
        await executor.close()
        return None
    
async def _run_command_loop(config: NanoConfig):
    executor = await _setup_executor(config) 
    if executor is None:
        return
    
    tab_id = None
    try:
        print("Welcome to the interactive Multi-Agent web automation tool. Type 'quit' to exit.")

        while True:
            command = input("Enter command (type 'quit' to exit): ").strip().lower()
            if command == "quit":
                break
            else:
                task_id = generate_new_task_id()
                await executor.run(command, task_id, tab_id=tab_id)
    except Exception as e:
        print(f"Error: {e}")
    finally:
        await executor.close()

async def _run_websocket_server(config: NanoConfig):
    executor = await _setup_executor(config)
    if executor is None:
        return
    
    try:
        await start_server(
            config.server.host,
            config.server.port,
            config.base_dir,
            executor
        )
    except Exception as e:
        print(f"Error: {e}")
    finally:
        await executor.close()

@click.group(invoke_without_command=True)
@click.option('-c', '--config', required=False, type=click.Path(exists=True), help='Path to config YAML file, defaults to config.yaml in current directory')
@click.pass_context
def cli(ctx, config):
    """NanoBrowser CLI application"""
    ctx.ensure_object(dict)
    
    # Try to find config.yaml if not specified
    if config is None:
        default_config = Path.cwd() / 'config.yaml'
        if default_config.exists():
            config = str(default_config)
        else:
            raise click.UsageError('No config file specified and no config.yaml found in current directory. '
                                 'Please specify a config file using -c/--config option.')
    
    ctx.obj['config'] = config
    
    if ctx.invoked_subcommand is None:
        ctx.invoke(serve)

@cli.command()
@click.pass_context
def serve(ctx):
    """Run the WebSocket server to work with chrome extension, this is the default command"""
    # Load config from YAML
    nano_config = NanoConfig.from_yaml(ctx.obj['config'])
    asyncio.run(_run_websocket_server(nano_config))

@cli.command()
@click.pass_context
def cmd(ctx):
    """Run the interactive command loop with configuration"""
    nano_config = NanoConfig.from_yaml(ctx.obj['config'])
    asyncio.run(_run_command_loop(nano_config))

if __name__ == '__main__':
    cli()