import React from "react";

import {Settings} from "../utils.js";

import ansiToHTML from "../ANSI-Escape.js"
import "./BuildLog.css";

const logFormatting = {
	all: [
		[">>> ", "command"],
		[">> ", "info"],
		[">! ", "info error"]
	],
	latex:[
		[/^Run number [0-9]+ of rule/, "command"],
		[/Package [a-zA-z0-9]+ Warning:/, "warning"],
		[/^\(([a-zA-z0-9]+)\)/, "warning"],
		[/LaTeX (?:[a-zA-z]+ )?Warning:/, "warning"],
		["Overfull \\hbox", "warning"],
		["Underfull \\hbox", "warning"],
		["Latexmk: List of undefined refs and citations:", "warning"],
		["Latexmk: Summary of warnings:", "warning"],
		[/ {2}Latex failed to resolve [0-9]+ (?:reference|citation)\(s\)/, "warning"],
		[/ {2}Label `[^']+' multiply defined/, "warning"],
		[/ {2}(?:Reference|Citation) ['`][^']+' on page [0-9]+ undefined on input line [0-9]+/, "warning"]
	]
};


function cleanupHTML(s){
	return s.replace(/<[^>]+>/g, "");
}


export default class BuildLog extends React.Component{
	constructor(props){
		super(props);
		this.state = {
			content: ansiToHTML(this.props.content),
			lines: [],
			commands: [],
			expanded: [],
			styles: logFormatting[this.props.lang] ? [...logFormatting["all"], ...logFormatting[this.props.lang]] : logFormatting["all"]
		};

		this.autoScroll = Settings.get("log.autoScroll");

		this.handleEvent = this.handleEvent.bind(this);
		this.scrolled = this.scrolled.bind(this);
	}

	handleEvent(e){
		const {event, ref, data} = JSON.parse(e.data);
		if(event === "log" && this.props.hash.indexOf(ref) === 0){
			this.logAdd(data);
		}
	}

	scrolled(e){
		this.autoScroll = false;
	}

	componentDidMount(){
		this.parse();
		this.props.events.addEventListener(this.props.proj, this.handleEvent);

		this.log.addEventListener("wheel", this.scrolled, { passive: true });
		this.log.addEventListener("touchmove", this.scrolled, { passive: true });

		if(this.props.status === "pending"){
			setTimeout(()=>this.last.scrollIntoView({ behavior: "instant" }), 0);
		}
	}

	componentWillUnmount(){
		this.props.events.removeEventListener(this.props.proj, this.handleEvent);

		this.log.removeEventListener("wheel", this.scrolled, { passive: true });
		this.log.removeEventListener("touchmove", this.scrolled, { passive: true });
	}


	getLines(d){
		return d.split("<br/>")
				.map((v, i, arr) => {
					const text = cleanupHTML(v)
					let style = this.state.styles.find(e => {
						return typeof e[0] === "object" ?
							(e[0].test(text)) :
							(text.indexOf(e[0]) === 0)
					});
					return [v, style ? style[1] : null];
				}).map(([v,style],i,arr)=>{
					const next = arr[i+1] || [];
					if(style && style === "command"){
						style = (next[1] === "info" || next[1] === "command") ? "command" : "command-exp"
					}
					return [v,style];
				});
	}

	parse(content = this.state.content){
		content = content.replace(/<br\/>$/, "");
		const lines = this.getLines(content);

		const commands = lines.reduce((acc, v, i)=>{
													if((v[1] || "").includes("command")){
														acc[i] = v;
													}
													return acc;
												}, {})

		const expanded = {};
		if(Settings.get("log.expandLast")){
			const cmdKeys = Object.keys(commands);
			if(cmdKeys.length > 0){
				for(let i = cmdKeys.length; i--; i !== 0){
					if(commands[cmdKeys[i]][1] === "command-exp"){
						expanded[cmdKeys[i]] = true;
						break;
					}
				}
			}
		}

		this.setState({
			lines,
			// commands,
			content: content,
			expanded: {...this.state.expanded, ...expanded}
		});
	}


	logAdd(add = ""){
		add = ansiToHTML(add.replace(/\s+$/, ''));
		if(add){
			const newContent = this.state.content + add;

			this.setState({
				content: newContent,
				lines: [...this.state.lines, ...this.getLines(add)]
			}, ()=> {if(this.autoScroll) this.last.scrollIntoView({ behavior: "smooth" }); } );
		}
	}

	componentDidUpdate(prevProps, prevState){
		if(this.props.content !== prevProps.content && this.props.content){
			this.parse(ansiToHTML(this.props.content));
		}

		if(this.props.status === "pending" && prevProps.status !== this.props.status){
			this.setState({
				content: "",
				lines: [],
				commands: [],
				expanded: []
			});
		}
	}

	render() {
		const pending = this.props.status === "pending";
		const showCollapsible = Settings.get("log.enableLogExpansion") && !pending;
		let lastCommandShow = !showCollapsible;
		const content = this.state.lines.map(([v,style],i, arr)=>{
							const text = {dangerouslySetInnerHTML: {__html: v}}
							if(style){
								if(showCollapsible){
									if(style.includes("command")){
										if(style === "command-exp"){
											lastCommandShow = this.state.expanded[i];
											return <div onClick={(e)=> this.setState(
												{	
													expanded: {...this.state.expanded, [i]: !this.state.expanded[i]}
												})
											} className={lastCommandShow ? "command-exp" : "command-mini"} key={i} {...text}/>;
										} else{
											return <div className="command" key={i} {...text}/>;
										}
									} else{
										if(style.indexOf("info")>-1){
											return <div className={style} key={i} {...text}/>;
										} else {
											return lastCommandShow && <div className={style} key={i} {...text}/>;
										}
									}
								} else {
									return <div className={style.replace("command-exp", "command")} key={i} {...text}/>;
								}
							} else {
								return lastCommandShow && <div key={i} {...text}/>;
							}
						});

		return	<pre ref={(el) => {if(el) this.log = el.parentElement}}>
					<code>
						{content}
						<div className="last" ref={(el) => { this.last = el; }}/>
					</code>
				</pre>;
	}
};