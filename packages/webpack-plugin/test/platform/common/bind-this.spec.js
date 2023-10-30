const bindThis = require('../../../lib/template-compiler/bind-this').transform
const { trimBlankRow } = require('../../../lib/utils/string')

describe('render function simplify should correct', function () {
  it('should normal delete is correct', function () {
    const input = `
      global.currentInject = {
        render: function () {
          a;
          if (a) {}
  
          b;
          c;
          a ? b : c
  
          a && b;
  
          d;
          e;
          if (a ? d : e) {}
          
          obj1;
          obj1.a;
          
          obj2;
          obj2.a.b;
  
          String(a).b.c;
          !!!String(a).b.c;
        }
      }
    `
    const res = bindThis(input, { needCollect: true, renderReduce: true }).code
    const output = `
global.currentInject = {
  render: function () {
    if (this._c("a", this.a)) {}
    this._c("c", this.c);
    this._c("a", this.a) ? this._c("b", this.b) : this._c("c", this.c);
    this._c("a", this.a) && this._c("b", this.b);
    this._c("d", this.d);
    this._c("e", this.e);
    if (this._c("a", this.a) ? this._c("d", this.d) : this._c("e", this.e)) {}
    this._c("obj1", this.obj1);
    this._c("obj2", this.obj2);
  }
};`
    expect(trimBlankRow(res)).toBe(trimBlankRow(output))
  })

  it('wxs check', function () {
    const input = `
    global.currentInject = {
      render: function () {
        if (bName) {} // 1
        this._p(bName)
        this._p(wxs.test(bName)) // 3
        this._p(wxs.test(bName + cName)) // 4
        Number(bName + cName) // 5
        this._p(Number(bName + cName)) // 6
        Object.keys({ name: bName }).length // 7

        this._p(Object.keys({ name: bName })) // 8

        this._p(Object.keys(bName)) // 9

        if (bName) {} // 10
        this._p(bName)
        wxs.test(bName); // 删除wxs.test
        this._p(wxs.test(bName + cName)) // 12
        this._p(wxs.test(bName + cName)) // 13
        Object.keys({ name: bName }).length // 14
        
        
        if (Object.keys({ name: bName }).length) {} // 15

        Object.keys({ name: bName }).length ? bName1 : bName2 // 16

        this._p(Object.keys({ name: bName }).length ? bName1 : bName2) // 17
      }
    }
    `
    const res = bindThis(input, { needCollect: true, renderReduce: true, ignoreMap: { wxs: true } }).code
    const output = `
global.currentInject = {
  render: function () {
    if (this._c("bName", this.bName)) {} // 1

    // 3
    wxs.test("" + this._c("cName", this.cName)); // 4
  
    Number("" + ""); // 5
  
    Number("" + ""); // 6
  
    Object.keys({
      name: ""
    }).length; // 7
  
    Object.keys({
      name: ""
    }); // 8
  
    // 9
    if (this._c("bName", this.bName)) {} // 10
    // 删除wxs.test
    wxs.test("" + ""); // 12
  
    wxs.test("" + ""); // 13
  
    Object.keys({
      name: ""
    }).length; // 14
    
    if (Object.keys({
      name: this._c("bName", this.bName)
    }).length) {} // 15
  
  
    Object.keys({
      name: this._c("bName", this.bName)
    }).length ? this._c("bName1", this.bName1) : this._c("bName2", this.bName2); // 16
  
    Object.keys({
      name: this._c("bName", this.bName)
    }).length ? this._c("bName1", this.bName1) : this._c("bName2", this.bName2); // 17
  }
};`
    expect(trimBlankRow(res)).toBe(trimBlankRow(output))
  })

  it('should Normal Scope Deletion is correct', function () {
    const input = `
    global.currentInject = {
      render: function () {
        (grade)
        if (random) {
          (name);
        } else {
          (grade)
          name
        }
        
        aName;
        if (random) {
          aName
        }
        
        bName;
        bName;
        if (random) {
          bName
        } else {
          bName
        }
        
        cName;
        if (random) {
          cName;
          dName;
          if (random2) {
            cName;
            dName;
          }
        }
      }
    }
    `
    const res = bindThis(input, { needCollect: true, renderReduce: true }).code
    const output = `
global.currentInject = {
  render: function () {
    this._c("grade", this.grade);

    if (this._c("random", this.random)) {
      this._c("name", this.name);
    } else {
      this._c("name", this.name);
    }

    this._c("aName", this.aName);

    if (this._c("random", this.random)) {}

    this._c("bName", this.bName);

    if (this._c("random", this.random)) {} else {}

    this._c("cName", this.cName);

    if (this._c("random", this.random)) {
      this._c("dName", this.dName);

      if (this._c("random2", this.random2)) {}
    }
  }
};`
    expect(trimBlankRow(res)).toBe(trimBlankRow(output))
  })

  it('should condition judgment is correct', function () {
    const input = `
      global.currentInject = {
        render: function () {
          name1;
          if (name1) {}
          if (name2) {}
          name2;
          
          name3;
          if (name3 ? 'big' : 'small') {}
          if (name2 ? name3 : 'small') {}
          
          name4;
          if ([name4].length) {}
          
          name5;
          name5 ? 'a' : 'b';
          a;
          b;
          name5 ? a : b
        }
      };
    `
    const res = bindThis(input, { needCollect: true, renderReduce: true }).code
    const output = `
global.currentInject = {
  render: function () {
    if (this._c("name1", this.name1)) {}

    if (this._c("name2", this.name2)) {}
  
    if (this._c("name3", this.name3) ? 'big' : 'small') {}
  
    if (this._c("name2", this.name2) ? this._c("name3", this.name3) : 'small') {}
  
    if ([this._c("name4", this.name4)].length) {}
  
    this._c("name5", this.name5) ? 'a' : 'b';
  
    this._c("a", this.a);
  
    this._c("b", this.b);
  
    this._c("name5", this.name5) ? this._c("a", this.a) : this._c("b", this.b);
  }
};`
    expect(trimBlankRow(res)).toBe(trimBlankRow(output))
  })

  it('should prefix check is correct', function () {
    const input = `
      global.currentInject = {
        render: function () {
          name;
          nameage;
          name.age
        }
      }
    `
    const res = bindThis(input, { needCollect: true, renderReduce: true }).code

    const output = `
global.currentInject = {
  render: function () {
    this._c("name", this.name);
    this._c("nameage", this.nameage);
  }
};`

    expect(trimBlankRow(res)).toBe(trimBlankRow(output))
  })

  it('should expression is correct', function () {
    const input = `
      global.currentInject = {
        render: function () {
          name;
          !name;
          !!name;
          !!!!!!!name;
          
          name2;
          name3;
          name3[name2];
          
          name4 && name4.length;
          name4['length']
          !name4.length;
          
          name5;
          this._p(name5);
          
          name6;
          name7;
          name6 + name7;
          name6 + '123';
          '123' + name7;
          '123' + name7 + name6;
          name6 + '123' + name7 + name6;
          
          
          name8;
          name9;
          ({ key: name8 && !name9 });
          ({ key: name9 });

          this._p(name10);
          if (xxx) {
            this._p(name10);
            if (name10){}
          }
          if (name10){}

          name11;
          Number(name11);
          
          this._p(name11);

          this._p(name12.length);
          this._p(name12);
          this._i(name12, function(item){})
        }
      }
    `
    const res = bindThis(input, { needCollect: true, renderReduce: true }).code
    const output = `
global.currentInject = {
  render: function () {
    this._c("name", this.name);

    this._c("name3", this.name3)[this._c("name2", this.name2)];
    this._c("name4", this.name4) && this._c("name4", this.name4).length;

    this._c("name5", this.name5);

    this._c("name6", this.name6);

    this._c("name7", this.name7);

    "" + "";
    "" + '123';
    '123' + "";
    '123' + "" + "";
    "" + '123' + "" + "";

    ({
      key: this._c("name8", this.name8) && !this._c("name9", this.name9)
    });
    ({
      key: ""
    });

    if (this._c("xxx", this.xxx)) {
      if (this._c("name10", this.name10)) {}

    }

    if (this._c("name10", this.name10)) {}


    this._c("name11", this.name11);

    this._i(this._c("name12", this.name12), function (item) {});
  }
};`
    expect(trimBlankRow(res)).toBe(trimBlankRow(output))
  })

  it('should backtrack variable deletion is correct', function () {
    const input = `
    global.currentInject = {
      render: function () {
        a
        {
          c
          {
            b
          }
          aa // 分割线
          {
            a
            b
            c
            d
          }
          b
        }
        b
      }
    }
    `
    const res = bindThis(input, { needCollect: true, renderReduce: true }).code
    const output = `
global.currentInject = {
  render: function () {
    this._c("a", this.a);

    {
      this._c("c", this.c);
  
      {}
  
      this._c("aa", this.aa); // 分割线
  
  
      {
        this._c("d", this.d);
      }
    }
  
    this._c("b", this.b);

  }
};`
    expect(trimBlankRow(res)).toBe(trimBlankRow(output))
  })

  it('should variable literal is correct', function () {
    const input = `
    global.currentInject = {
      render: function () {
        a.b;
        if (a['b']) {}
        c;
        a[c];
        c.d;
        a.b[c.d];
      }
    }`
    const res = bindThis(input, { needCollect: true, renderReduce: true }).code
    const output = `
global.currentInject = {
  render: function () {
    if (this._c("a.b", this.a['b'])) {}

    this._c("a", this.a)[this._c("c", this.c)];
    this._c("a.b", this.a.b)[this._c("c.d", this.c.d)];
  }
};`
    expect(trimBlankRow(res)).toBe(trimBlankRow(output))
  })

  it('should object is correct', function () {
    const input = `
    global.currentInject = {
      render: function () {

        handlerName;
        ({tap:[["handler",true, 123]],click:[["handler",handlerName]]});
  
        aName;
        ({
          open: true,
          str: 'str',
          name: aName
        });
  
        ({
          name: bName
        });
        if (bName) {}
        this._p(bName)
        Number(bName + cName)
        this._p(Number(bName + cName))
        Object.keys({ name: bName }).length
        
        if (Object.keys({ name: bName }).length) {}
        
        Object.keys({ name: bName }).length ? bName1 : bName2
        
        this._p(Object.keys({ name: bName }).length ? bName1 : bName2)
        
        this._p(Object.keys({ name: bName }))
        
        this._p(Object.keys(bName))
      }
    }`
    const res = bindThis(input, { needCollect: true, renderReduce: true }).code
    const output = `
global.currentInject = {
  render: function () {
    this._c("handlerName", this.handlerName);

    ({
      tap: [["handler", true, 123]],
      click: [["handler", ""]]
    });
  
    this._c("aName", this.aName);
  
    ({
      open: true,
      str: 'str',
      name: ""
    });
    ({
      name: ""
    });
  
    if (this._c("bName", this.bName)) {}
  
    Number("" + this._c("cName", this.cName));
    Number("" + "");
    Object.keys({
      name: ""
    }).length;
  
    if (Object.keys({
      name: this._c("bName", this.bName)
    }).length) {}
  
    Object.keys({
      name: this._c("bName", this.bName)
    }).length ? this._c("bName1", this.bName1) : this._c("bName2", this.bName2);
    Object.keys({
      name: this._c("bName", this.bName)
    }).length ? this._c("bName1", this.bName1) : this._c("bName2", this.bName2);
    Object.keys({
      name: ""
    });
  }
};`
    expect(trimBlankRow(res)).toBe(trimBlankRow(output))
  })

  it('should operation is correct', function () {
    const input = `
    global.currentInject = {
      render: function () {
        if((a || b)){
          this._p((a || b));
        }
        
        if (c) {}
        ({ active: !c })
      }
    };`
    const res = bindThis(input, { needCollect: true, renderReduce: true }).code
    const output = `
global.currentInject = {
  render: function () {
    if (this._c("a", this.a) || this._c("b", this.b)) {
      this._c("a", this.a) || this._c("b", this.b);
    }

    if (this._c("c", this.c)) {}

    ({
      active: ""
    });
  }
};`
    expect(trimBlankRow(res)).toBe(trimBlankRow(output))
  })

  it('should Keep the options in the ternary operation', function () {
    const input = `
    global.currentInject = {
      render: function () {
        a;
        b;
        c;
        if (a ? b : c) {}
        a;
        b;
        c;
      }
    };`
    const res = bindThis(input, { needCollect: true, renderReduce: true }).code
    const output = `
global.currentInject = {
  render: function () {
    this._c("b", this.b);
  
    this._c("c", this.c);
    
    if (this._c("a", this.a) ? this._c("b", this.b) : this._c("c", this.c)) {}
  }
};`
    expect(trimBlankRow(res)).toBe(trimBlankRow(output))
  })

  it('should needCollect config is correct', function () {
    const input = `
      global.currentInject = {
        render: function () {
          name;
          !name;
          !!name;
          !!!!!!!name;
          
          name2;
          name3;
          name3[name2];
          
          name4 && name4.length;
          name4['length']
          !name4.length;
          
          name5;
          this._p(name5);
          
          name6;
          name7;
          name6 + name7;
          name6 + '123';
          '123' + name7;
          '123' + name7 + name6;
          name6 + '123' + name7 + name6;
        }
      }
    `
    const res = bindThis(input, { needCollect: false, renderReduce: true }).code
    const output = `
global.currentInject = {
  render: function () {
    this.name;
    this.name3[this.name2];
    this.name4 && this.name4.length;
    this.name5;
    this.name6;
    this.name7;
    "" + "";
    "" + '123';
    '123' + "";
    '123' + "" + "";
    "" + '123' + "" + "";
  }
};`
    expect(trimBlankRow(res)).toBe(trimBlankRow(output))
  })

  it('should propKeys is correct', function () {
    const input = `
      global.currentInject = {
        render: function () {
          this._p(a);
          this._p(a + b);
          this._p(a && c);
          this._p(a || d);
          this._p(name.b.c && name2.b);
        }
      }
    `
    const res = bindThis(input, { renderReduce: true })
    const output = ['a', 'b', 'a', 'c', 'a', 'd', 'name', 'name2']
    expect(res.propKeys.join('')).toBe(output.join(''))
  })
})
