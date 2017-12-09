import React from "react";
import {Link} from "react-router-dom";

import {ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, Legend} from 'recharts';

import {Errors, Settings} from "../utils.js";

import "./BuildStatistics.css";

export default class BuildStatistics extends React.Component {
	constructor(props){
		super(props);

		this.state = {
			hide: Settings.get("stats.hide"),
			xType: Settings.get("stats.xType")
		};

		this.data = {};

		this.legendClick = this.legendClick.bind(this);
		this.typeChange = this.typeChange.bind(this);
		this.label = this.label.bind(this);
		this.labelTooltip = this.labelTooltip.bind(this);
	}

	typeChange(e){
		const v = e.target.value;
		this.setState({xType: v}, ()=>Settings.set(`stats.xType`, v))
	}

	legendClick(e){
		const proj = this.props.match.params.proj.replace(/ /g, "-");
		const v = {
			hide: {
				...this.state.hide,
				[proj]: {
					...this.state.hide[proj],
					[e.dataKey.replace(/ /g, "-")]: !e.inactive
				}
			}
		};
		this.setState(v, ()=>Settings.set(`stats.hide`, v.hide))
	}

	label(t){
		const d = new Date(t);
		return `${String(d.getFullYear()).slice(-2)}/${d.getMonth()+1}/${d.getDate()}`;
	}

	labelTooltip(t){
		const ref = this.data[t];
		return ref ? ref.slice(0,7) : null;
	}

	render(){
		const {proj} = this.props.match.params;
		const {language, list} = this.props.info.data;
		const hide = this.state.hide ? (this.state.hide[proj] || {}) : {};
		let diagram = null;
		if(language === "latex"){
			this.data = {};
			const data = list.map((v)=>{
										if(this.state.xType === "time"){
											this.data[v.commit.date.getTime()] = v.commit.ref;
											if(v.build.status === "success" && v.build.stats.counts){
													return {
														date: v.commit.date.getTime(),
														ref: v.commit.ref,
														words: +v.build.stats.counts.words.total[0],
														letters: +v.build.stats.counts.letters.total[0],
														buildTime: Math.round(v.build.duration)
													}
											} else {
												return {
													date: v.commit.date.getTime()
												}
											}
										} else {
											if(v.build.status === "success" && v.build.stats.counts){
													return {
														date: `${String(v.commit.date.getFullYear()).slice(-2)}/${v.commit.date.getMonth()+1}/${v.commit.date.getDate()} ${v.commit.ref.slice(0,7)}`,
														words: +v.build.stats.counts.words.total[0],
														letters: +v.build.stats.counts.letters.total[0],
														buildTime: Math.round(v.build.duration)
													}
											} else {
												return {
													date: `${String(v.commit.date.getFullYear()).slice(-2)}/${v.commit.date.getMonth()+1}/${v.commit.date.getDate()} ${v.commit.ref.slice(0,7)}`,
												}
											}
										}
									}).reverse();

			diagram = <LineChart data={data}>
							{ this.state.xType === "time" ?
								<XAxis dataKey="date"
									domain = {['dataMin', 'dataMax']}
									name = 'Time'
									tickFormatter = {this.label}
									type = 'number'/>
									:
								<XAxis dataKey="date" />
							}

							<YAxis label={{ value: 'Count', angle: -90, position: 'left', offset: -5 }} 
									orientation="left"
									yAxisId="counts"/>
							<YAxis label={{ value: 'Build Time (sec)', angle: -90, position: 'insideRight', offset: 10 }}
									orientation="right"
									yAxisId="time"/>
							{ this.state.xType === "time" ?
								<Tooltip labelFormatter={this.labelTooltip}/>
								:
								<Tooltip />
							}
							<Legend onClick={this.legendClick}/>
							<Line hide={hide["words"]}     dataKey="words"     name="Words"      type="monotone" strokeWidth="2" stroke="#8884d8" yAxisId="counts" animationDuration={200}/>
							<Line hide={hide["letters"]}   dataKey="letters"   name="Letters"    type="monotone" strokeWidth="2" stroke="#82ca9d" yAxisId="counts" animationDuration={200}/>
							<Line hide={hide["buildTime"]} dataKey="buildTime" name="Build Time" type="monotone" strokeWidth="2" stroke="#ff7f0e" yAxisId="time"   animationDuration={200}/>
						</LineChart>
		}
		return (
		<div className="buildStatistics">
			<h1>
				<Link to="." title="Go Back to List">{proj}</Link> &gt; Statistics
				<span style={{float: "right"}}>
					<select value={this.state.xType} onChange={this.typeChange}>
						<option value="commits">Commits</option>
						<option value="time">Time</option>
					</select>
				</span>
			</h1>
			<div className="content">
				<div className="window">
					{
						diagram ? 
						<ResponsiveContainer minHeight={400} width="100%" height="100%">
							{diagram}
						</ResponsiveContainer>
							:
						<Errors>No statistics available for your project</Errors>}
				</div>
			</div>
		</div>
		)
	}
};