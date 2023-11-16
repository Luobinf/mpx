const bindThis = require('../../../lib/template-compiler/bind-this').transform
const { trimBlankRow } = require('../../../lib/utils/string')

describe('render function simplify should correct', function () {
  it('should normal delete is correct', function () {
    const input = `
      global.currentInject.render = function (_i, _c, _r, _sc) {
        a;
        if (a) {}

        b;
        c;
        a ? b : c

        a && b;

        d;
        e;
        a ? d : e
        d;
        e;
        
        f;
        g;
        if (f + g) {}
        
        obj1;
        obj1.a;
        
        obj2;
        obj2.a.b;

        obj3;
        String(obj3).b.c;
        this._p(obj3)
        String(obj3,'123').b.c
        !!!String(obj3).b.c;
        _i(obj3, function() {})

        obj5
        !obj5
        !!obj5
        !!!!!!!obj5

        name;
        nameage;
        name.age
        
        handlerName;
        ({tap:[["handler",true, 123]],click:[["handler",handlerName]]});
  
        aName;
        ({
          open: true,
          str: 'str',
          name: aName
        });
      }`
    const res = bindThis(input, { needCollect: true, renderReduce: true }).code
    const output = `
global.currentInject.render = function (_i, _c, _r, _sc) {
  if (_sc("a")) {}

  _sc("c");

  _sc("a") ? _sc("b") : _sc("c");
  _sc("a") && _sc("b");

  _sc("d");

  _sc("e");

  _sc("a") ? _sc("d") : _sc("e");

  if (_sc("f") + _sc("g")) {}

  _sc("obj1");

  _sc("obj2");

  String(_sc("obj3"), '123').b.c;
  _i(_sc("obj3"), function () {});

  _sc("obj5");

  _sc("name");

  _sc("nameage");

  _sc("handlerName");

  ({
    tap: [["handler", true, 123]],
    click: [["handler", ""]]
  });

  _sc("aName");

  ({
    open: true,
    str: 'str',
    name: ""
  });
};`
    expect(trimBlankRow(res)).toBe(trimBlankRow(output))
  })

  it('should computed delete is correct', function () {
    const input = `
      global.currentInject.render = function (_i, _c, _r, _sc) {
        a.b
        if (a['b']) {}
        c;
        a[c];
        c.d;
        a.b[c.d];
        e;
        e[0].name
      }`
    const res = bindThis(input, { needCollect: true, renderReduce: true }).code
    const output = `
global.currentInject.render = function (_i, _c, _r, _sc) {
  if (_c("a.b")) {}

  _sc("a")[_sc("c")];
  _c("a.b")[_c("c.d")];

  _sc("e");
};`
    expect(trimBlankRow(res)).toBe(trimBlankRow(output))
  })

  it('should expression delete is correct', function () {
    const input = `
      global.currentInject.render = function (_i, _c, _r, _sc) {
        // 逻辑运算          
        obj3 || ''
        obj3 && obj3.b
        obj4
        obj4 || 123 || ''
        '456' || obj4 || ''
        '' || 123 || obj4

        obj5 + 'rpx'
        'height:' + obj5 + 'rpx'
        'height' + ':' + obj5
      }`
    const res = bindThis(input, { needCollect: true, renderReduce: true }).code
    const output = `
global.currentInject.render = function (_i, _c, _r, _sc) {
  // 逻辑运算          
  _sc("obj3") && _c("obj3.b");
  '' || 123 || _sc("obj4");

  _sc("obj5") + 'rpx';
  'height:' + "" + 'rpx';
  'height' + ':' + "";
};`
    expect(trimBlankRow(res)).toBe(trimBlankRow(output))
  })

  it('should backtrack variable deletion is correct', function () {
    const input = `
    global.currentInject.render = function (_i, _c, _r, _sc) {
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
    `
    const res = bindThis(input, { needCollect: true, renderReduce: true }).code
    const output = `
global.currentInject.render = function (_i, _c, _r, _sc) {
  _sc("a");

  {
    _sc("c");

    {}

    _sc("aa"); // 分割线


    {
      _sc("d");
    }
  }

  _sc("b");

};`
    expect(trimBlankRow(res)).toBe(trimBlankRow(output))
  })

  it('should scope var is correct', function () {
    const input = `
      global.currentInject.render = function (_i, _c, _r, _sc) {
        this._i(list, function (item, index) {
          item;
          index;
          item.a ? "" : item.b;
          item.a || "";
          item.a || item.b;
        });
      }
    `
    const res = bindThis(input, { needCollect: false, renderReduce: true }).code
    const output = `
global.currentInject.render = function (_i, _c, _r, _sc) {
  this._i(this.list, function (item, index) {
    item.a ? "" : item.b;
    item.a || item.b;
  });
};`
    expect(trimBlankRow(res)).toBe(trimBlankRow(output))
  })

  it('should propKeys is correct', function () {
    const input = `
      global.currentInject.render = function (_i, _c, _r, _sc) {
        this._p(a);
        this._p(a + b);
        this._p(a && c);
        this._p(a || d);
        this._p(name.b.c && name2.b);
      }
    `
    const res = bindThis(input, { renderReduce: true })
    const output = ['b', 'a', 'c', 'a', 'd', 'name', 'name2']
    expect(res.propKeys.join('')).toBe(output.join(''))
  })

  it('should needCollect config is correct', function () {
    const input = `
      global.currentInject.render = function (_i, _c, _r, _sc) {
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
    `
    const res = bindThis(input, { needCollect: false, renderReduce: true }).code
    const output = `
global.currentInject.render = function (_i, _c, _r, _sc) {
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
};`
    expect(trimBlankRow(res)).toBe(trimBlankRow(output))
  })
})
