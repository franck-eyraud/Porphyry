import React from 'react';
import { Link } from 'react-router-dom';
import Hypertopic from 'hypertopic';
import conf from '../../config/config.json';
import Header from '../Header/Header.jsx';
import Authenticated from '../Authenticated/Authenticated.jsx';
import TopicTree from './TopicTree.js';

import '../../styles/App.css';

const db = new Hypertopic(conf.services);

const _log = (x) => console.log(JSON.stringify(x, null, 2));
const _error = (x) => console.error(x.message);

class Outliner extends React.Component {

  constructor() {
    super();
    this.state = { };
    this.changing=false;
    this.user = conf.user || window.location.hostname.split('.', 1)[0];
  }

  render() {
    let status = this._getStatus();
    let topic={name:this.state.title};
    return (
      <div className="App container-fluid">
        <Header />
        <div className="Status row h5">
          <Authenticated/>
          <Link to="/" className="badge badge-pill badge-light TopicTag">
            <span className="badge badge-pill badge-dark oi oi-chevron-left"> </span> Retour à l'accueil
          </Link>
        </div>
        <div className="container-fluid">
          <div className="App-content row">
            <div className="col-md-12 p-4">
              <div className="Description">
                <h2 className="h4 font-weight-bold text-center">{status}</h2>
                <div className="p-3">
                  {this.state.title ? '' : this._getTitle()}
                  <ul className="Outliner">
                    <Node topics={this.state.topics} me={topic} activeNode={this.state.activeNode}
                      change={this.editTopic.bind(this)} activate={this.activeNode.bind(this)} id="root"/>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  _getTitle() {
    return (<form className="input-group" onSubmit={(e) => this._newVP(e)}>
      <input type="text" name="newTitle" className="form-control" placeholder="Nom du point de vue" />
      <div className="input-group-append">
        <button type="submit" className="btn add btn-sm btn-light"><span className="oi oi-plus"> </span></button>
      </div>
    </form>);
  }

  _getStatus() {
    if (this.state.title !== undefined) {
      return "Modification du point de vue";
    } else {
      return "Création du point de vue";
    }
  }

  _newVP(e) {
    e.preventDefault();
    let title = e.target.newTitle.value;
    if (!title) {
      return;
    }
    db.post({ _id: this.props.match.params.id, viewpoint_name: title, topics: {}, users: [this.user] })
      .then(_log)
      .then(_ => this.setState({ title }))
      .then(_ => this._fetchData())
      .catch(_error);
  }

  activeNode(id) {
    this.setState({activeNode:id});
  }

  handleKeyAction(e) {
    console.log("handleKeyAction "+e.key);
    var changed=false;
    switch (e.key) {
      case "Enter":
        var topic=this.topicTree.newSibling(this.state.activeNode);
        this.activeNode(topic.id);
        topic.new=true;
        e.preventDefault();
        this.setState(function(previousState) {
          // previousState.temptopics=previousState.temptopics || [];
          // previousState.temptopics.push(topic.id);
          previousState.topics=this.topicTree.topics;
          return previousState;
        });
        return;
      case "Tab":
        if (!e.altKey && !e.ctrlKey) {
          if (e.shiftKey) {
            changed=this.topicTree.promote(this.state.activeNode);
          } else {
            changed=this.topicTree.demote(this.state.activeNode);
          }
        }
        break;
      case 'ArrowUp':
        if (!e.altKey && !e.ctrlKey && !e.shiftKey) {
          this.activeNode(this.topicTree.getPreviousTopic(this.state.activeNode));
        }
        if (e.ctrlKey && !e.altKey && !e.shiftKey) {
          changed=this.topicTree.moveUp(this.state.activeNode);
        }
        break;
      case 'ArrowDown':
        if (!e.altKey && !e.ctrlKey && !e.shiftKey) {
          this.activeNode(this.topicTree.getNextTopic(this.state.activeNode));
        }
        if (e.ctrlKey && !e.altKey && !e.shiftKey) {
          changed=this.topicTree.moveDown(this.state.activeNode);
        }
        break;
      case 'Delete':
      case 'Backspace':
        if (!e.altKey && !e.ctrlKey && !e.shiftKey) {
          if (e.target.tagName==="BODY" || e.target.value==='' ) {
            let previousTopic=this.topicTree.getPreviousTopic(this.state.activeNode);
            changed=this.topicTree.deleteTopic(this.state.activeNode);
            if (changed) this.activeNode(this.topicTree.getNextTopic(previousTopic));
          }
        }
        break;
      default:
    }
    if (changed) {
      e.preventDefault();
      this.setState({topics:this.topicTree.topics},this.applyChange.bind(this));
    }
    return;
  };

  editTopic(id,change) {
    if (!this.setState) {
      return;
    }
    var toApply=false;
    return this.setState(previousState => {
      let topics=previousState.topics;
      if (topics) {
        let topic;
        if (!id) {
          if (change.name && change.name!==previousState.title) {
            toApply=true;
            return {title:change.name}
          }
        } else if (topics[id]) {
          if (change.delete) {
            if (!topics[id].new) toApply=true;
            delete topics[id];
          } else {
            topic=topics[id];
          }
        }
        if (topic) {
          for (let key in change) {
            if (topic[key]!==change[key]) {
              topic[key]=change[key];
              toApply=true;
            }
          }
          delete topic.new;
        }
        return {topics};
      }
      return {};
    },function() {
      if (toApply) this.applyChange();
    });
  }

  deleteTopic(id) {

  }

  componentDidMount() {
    this._fetchData();
    //this._timer = setInterval(this._fetchData.bind(this),1000);
    document.addEventListener("keypress", this.handleKeyAction.bind(this));
    document.addEventListener("keydown", this.handleKeyAction.bind(this));
  }

  componentWillUnmount() {
    clearInterval(this._timer);
  }

  applyChange() {
    if (!this.changing) {
      this.changing=db.get({ _id: this.props.match.params.id })
        .then(data => {
          data.topics ={};
          for (var id in this.state.topics) {
            if (!this.state.topics.new) {
              data.topics[id]=this.state.topics[id];
            }
          }
          data.viewpoint_name = this.state.title;
          return data;
        })
        .then(db.post)
        .catch(_ => {
          _error(_);
          this._fetchData();
        }).finally(() => {
          this.changing=false;
        });
    }
    return this.changing;
  }

  _fetchData() {
    if (!this.changing) {
    return db.get({ _id: this.props.match.params.id })
      .then(x => {
        this.setState({ topics: x.topics, title: x.viewpoint_name });
        this.topicTree=new TopicTree(x.topics);
      });
    } else {
      return true;
    }
  }

}

class Node extends React.Component {

  constructor() {
    super();
    this.state = { edit: false, active: false, open: true };
    this.user = conf.user || window.location.hostname.split('.', 1)[0];
  }

  render = () => {
    let change=this.props.change;
    let switchOpen = () => {
      this.setState({open:!this.state.open});
    }
    let switchEdit = (e) => {
      e.stopPropagation();
      if (this.state.edit && this.props.me.new) {
        change(this.props.id,{delete:true});
      } else {
        this.setState({edit:!this.state.edit});
      }
    }
    let commitEdit = (e) => {
      let newName=e.target.value;
      change(this.props.id,{name:newName});
      switchEdit(e);
    }
    let handleInput = (e) => {
      console.log("handleInput "+e.key);
      switch(e.key) {
        case "Enter":
          commitEdit(e);
          e.stopPropagation();
          break;
        case "Escape":
          switchEdit(e);
          e.stopPropagation();
          break;
        default:
      }
    };
    let activeMe = (e) => {
      e.stopPropagation();
      this.props.activate(this.props.id);
    }
    let thisNode;
    if (this.state.edit || !this.props.me.name) {
      thisNode=<input autoFocus type='text' defaultValue={this.props.me.name} onKeyPress={handleInput} onKeyDown={handleInput} onBlur={commitEdit}/>;
    } else {
      thisNode=<span className="node" onDoubleClick={switchEdit}>{this.props.me.name}</span>;
    }
    let children=[];
    if (this.props.topics) {
      for (var topID in this.props.topics) {
        let topic=this.props.topics[topID];
        if ((this.props.id && topic.broader.indexOf(this.props.id)!==-1)
          || (this.props.id==="root" && topic.broader.length===0)) {
            children.push(
              <Node key={topID} me={topic} id={topID} topics={this.props.topics} activeNode={this.props.activeNode} parent={this.props.id}
                activate={this.props.activate} change={this.props.change} delete={this.props.delete}/>
            );
        }
      }
    }
    var classes=["outliner-node"];
    if (this.props.activeNode===this.props.id) {
      classes.push("active");
    }
    let caret;
    if (this.props.id && children.length) {
      caret=<span className="caret" onClick={switchOpen}> </span>;
      if (this.state.open) classes.push("open");
      else classes.push("closed");
    } else {
      caret=null;
    }
    function setEdit(e) {
      if (!this.state.edit) switchEdit(e);
    }
    return (
      <li className={classes.join(" ")}>
        {caret}<span className="wrap" onClick={activeMe} onDoubleClick={setEdit}>{thisNode}<span className="id">{this.props.id}</span></span>
        <ul>{children}</ul>
      </li>);
  };

  nodeKeyAction(e) {
    if (this.props.id===this.props.activeNode) {
      switch (e.key) {
        case "Enter":
        this.state.newChildren=this.state.newChildren || [];
        this.state.newChildren.push({
          previousSibling:this.props.activeNode,
          broader:this.props.broader
        });
      }
    }
    return;
  }

  componentDidMount() {
    document.addEventListener("keypress", this.nodeKeyAction.bind(this));
  }


}

export default Outliner;
