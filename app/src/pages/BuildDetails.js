import React from "react";
import {Link} from "react-router-dom";
import "./BuildDetails.css";
import "./Build.css";

import {Loading, Errors, formatDate, formatTime, humanDate, withFetcher, strToColor} from "../utils.js";
import {getJWT} from "../auth.js";

import ansiToHTML from "../ANSI-Escape.js"

const logFormatting = {
	all: [
		[">>> ", "command"],
		[">> ", "info"],
		[">! ", "info error"]
	],
	latex:[
		[/Package [a-zA-z0-9]+ Warning:/, "warning"],
		[/^\(([a-zA-z0-9]+)\)/, "warning"],
		[/LaTeX (?:[a-zA-z]+ )?Warning:/, "warning"],
		["Overfull \\hbox", "warning"],
		["Underfull \\hbox", "warning"],
		["Latexmk: List of undefined refs and citations:", "warning"],
		[/ {2}Label `[^']+' multiply defined/, "warning"]
	]
};


function cleanupHTML(s){
	return s.replace(/<[^>]+>/g, "");
}


class Log extends React.Component{
	constructor(props){
		super(props);

		this.state = {
			content: ansiToHTML(this.props.content, "white"),
			lines: [],
			commands: [],
			expanded: [],
			styles: logFormatting[this.props.lang] ? [...logFormatting["all"], ...logFormatting[this.props.lang]] : logFormatting["all"]
		};

		this.handleEvent = this.handleEvent.bind(this);
	}

	handleEvent(e){
		const {event, data} = JSON.parse(e.data);
		if(event === "log"){
			this.reload(data);
		}
	}

	componentDidMount(){
		this.reload();
		this.props.events.addEventListener(this.props.proj, this.handleEvent);
	}

	componentWillUnmount(){
		this.props.events.removeEventListener(this.props.proj, this.handleEvent);
	}


	reload(add = ""){
		if(add)	add = ansiToHTML(add);

		const newContent = add === false ? "" : (this.state.content + add);

		const getLines = d => d
						.split("<br/>")
						.map((v, i, arr) => {
							const text = cleanupHTML(v)
							const style = this.state.styles.find(e => {
								return typeof e[0] === "object" ?
									(e[0].test(text)) :
									(text.indexOf(e[0]) === 0)
							});
							return [v, style ? style[1] : null];
						});

		if(add){
			this.setState({
				content: newContent,
				lines: [...this.state.lines, ...getLines(add)]
			}, ()=> this.last.scrollIntoView({ behavior: "smooth" }) );
		} else if(add === false){
			this.setState({
				content: "",
				lines: [],
				commands: [],
				expanded: []
			});
		} else {
			const lines = getLines(newContent);

			const commands = lines.reduce((acc, v, i)=>{
														if((v[1] || "").includes("command"))
															acc[i]=v;
														return acc;
													}, {})

			const expanded = {};

			if(lines.length > 0 && (!lines[lines.length-1][1] || !lines[lines.length-1][1].includes("info"))){
				const cmdKeys = Object.keys(commands);
				expanded[cmdKeys[cmdKeys.length-1]] = true;
			}

			this.setState({
				lines,
				commands,
				content: newContent,
				expanded: {...this.state.expanded, ...expanded}
			});
		}
	}

	componentDidUpdate(prevProps, prevState){
		if(this.props.status !== "pending" && this.props.content !== prevProps.content){
			this.reload();
		}

		if(this.props.status === "pending" && prevProps.status !== this.props.status){
			this.reload(false);
		}
	}

	
	render() {
		const pending = this.props.status === "pending";
		return	<pre>
					<code>
						{(()=>{
						const showCollapsible = window.matchMedia("(min-width: 660px)").matches && !pending;
						let lastCommandShow = !showCollapsible;
						return this.state.lines.map(([v,style],i, arr)=>{
							const text = {dangerouslySetInnerHTML: {__html: v}}
							if(style){
								if(showCollapsible){
									if(style === "command"){
										if(i !== arr.length-1){
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
									return <div className={style} key={i} {...text}/>;
								}
							} else {
								return lastCommandShow && <div key={i} {...text}/>;
							}
						})
						})()}
						<div className="last" ref={(el) => { this.last = el; }}/>
					</code>
				</pre>
	}
}


export default withFetcher(class BuildDetails extends React.Component {
	constructor(props){
		super(props);

		this.state = {
			files: {}
		};

		this.rebuildInterval = null;
	}

	componentDidMount(){
		if(this.props.info.data){
			this.hash = this.props.match.params.hash;
			this.commit = this.props.info.data.list.find((v)=> v.commit.ref === this.hash);

			this.load("log");

			let {hash} = this.props.match.params;
			if(hash === "latest"){
				hash = this.props.info.data.latest;
			}
			const c = this.props.info.data.list.findIndex((v)=> v.commit.ref === hash);
			if(this.props.info.data.list[c+1]){
				this.load(`diff/${this.props.info.data.list[c+1].commit.ref}`, res=>res.json(), "diff");
			}
		}
	}

	componentWillReceiveProps(nextProps){
		this.commit = nextProps.info.data.list.find((v)=> v.commit.ref === this.hash);

		if(nextProps.info.data.list.find((v)=> v.commit.ref === this.hash).build.status === "success"){
			this.load("log");
		}
	}

	componentWillUnmount(){
		if(this.rebuildInterval !== null){
			clearInterval(this.rebuildInterval);
			this.rebuildInterval = null;
		}
	}

	getURL(file, query=false){
		if(file) file = "/"+file;
		return `/api/${this.props.match.params.proj}/${this.hash}${file}`+
				(query?`?token=${getJWT()}`:"");
	}

	load(file, type=(res)=>res.text(), as=file){
		this.setState({files: {...this.state.files, [as]: {loading: true}}});
		return this.props.fetch(this.getURL(file))
			.then(type)
			.then(res => this.setState({
					files: {
						...this.state.files,
						[as]: {
							content: res,
							loading: false,
						}
					}
				}))
			.catch(() => this.setState({
					files: {
						...this.state.files,
						[as]: {
							loading: false,
							error: true
						},
					}
				}, ))
	}

	rebuild(){
		this.props.fetch(this.getURL("build"));
	}

	render(){
		let {proj, hash} = this.props.match.params;
		if(this.props.info.data.list){
			if(hash === "latest"){
				hash = this.props.info.data.latest;
			}

			if(this.commit){
				const {build, commit} = this.commit;
				return (
					<div>
						<h1><Link to="." title="Go Back to List">{proj}</Link> &gt; {hash.substring(0,7)}</h1>
						<div className="buildDetails">
							<div className="details">
								<div className={`window build buildStatus ${build.status}`}>
									<div>
										<img className="avatar" alt="" style={!commit.author_avatar ? {backgroundColor: "#"+strToColor(commit.author_name)} : null} src={commit.author_avatar || null}/>{commit.author_name}<br/>
										{commit.msg}<br/>
										<a title="Open on Github" href={commit.url} target="_blank">{commit.ref}</a> ({humanDate(commit.date)})<br/>
									</div>
									<div>
										<span title={formatDate(build.start)}>started {humanDate(build.start)} </span><br/>
										{build.duration ? <span>took {formatTime(build.duration)}</span> : null} <br/>
									</div>
									<div>
										<a className="button" onClick={() => this.rebuild()} style={build.status === "pending" ? {pointerEvents: "none", opacity: 0.5} : null}>
											<i className={`fa fa-refresh ${build.status === "pending" ? "fa-spin" : ""}`} style={{marginRight: "4px"}}/>{build.status === "pending" ? "Building" : "Rebuild"}
										</a>
									</div>
								</div>
							</div>
							<div className="files">
								<div className="window artifacts">
									{
										build.artifacts && 	Object.keys(build.artifacts).length > 0 &&
										<div>
											Artifacts: <br/>
											<ol>
												{
													Object.keys(build.artifacts).map(v=>(
														<li key={v}><a target="_blank" href={this.getURL(v, true)}>
															{build.artifacts[v]}
														</a></li>
													))
												}
											</ol>
										</div>
									}
									{
										build.stats && build.stats.counts ? 
										( 
										(()=>{
											const letters = build.stats.counts.letters;
											const [sumc/*, text, headers, outside, headersN, floatsN, mathsI, mathsD*/] = letters.total;

											return (
											<div>
												<span>Total letters: {sumc}</span>
												<ol>
												{
													letters.chapters.map((v)=>{
														let [name, text/*, headers, captions, headersH, floatsH, inlinesH, displayedH*/] = v;
														const style = name.startsWith("Section") ? {paddingLeft: ".7em"} : null;
														return <li key={name} style={style}>{name}: {text}</li>;
													})
												}
												</ol>
											</div>);
										})()
										) : null
									}
									{
										this.state.files["diff"] && this.state.files["diff"].content && (
											this.state.files["diff"].content.commits.length > 0 ?
											(<div>
												<a title="Compare on Github" href={this.state.files["diff"].content.diff} target="_blank">Commits</a> between last build:
												<ol>
													{
														this.state.files["diff"].content.commits.map(v=>(
															<li key={v.ref}>{v.msg.split("\n")[0]} <a title="Open on Github" href={v.url} target="_blank">({v.ref.substring(0,7)})</a></li>
														))
													}
												</ol>
											</div>)
											:
											(<div>
												<a title="Compare on Github" href={this.state.files["diff"].content.diff} target="_blank">Compare to last build's commit</a>
											</div>)
										)
									}
								</div>
								<div className="window log">
									{
										this.state.files["log"] &&
										(this.state.files["log"].loading ? <Loading opacity={0.5}/> :
											this.state.files["log"].error ? <Errors/> : 
											<Log events={this.props.events} proj={proj} lang={this.props.info.data.language} status={build.status} content={this.state.files["log"].content}/>
										)
									}
								</div>
							</div>
						</div>
					</div>
				);
			}
		}
		return null;
	}

});